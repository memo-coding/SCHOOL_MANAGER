const mongoose = require('mongoose');
const { Fee, Student, Class } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { PAGINATION } = require('../config/constants');
const stripe = require('../config/stripe');

const getFees = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.student_id) {
    filter.student_id = req.query.student_id;
  }
  if (req.query.academic_year) {
    filter.academic_year = req.query.academic_year;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.fee_type) {
    filter.fee_type = req.query.fee_type;
  }

  // OPTIMIZED: Added lean() for faster query
  const [fees, total] = await Promise.all([
    Fee.find(filter)
      .populate({
        path: 'student_id',
        populate: {
          path: 'user_id',
          select: 'personal_info'
        }
      })
      .populate('created_by', 'personal_info')
      .skip(skip)
      .limit(limit)
      .sort({ due_date: -1 })
      .lean(),
    Fee.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    message: 'Fees retrieved successfully',
    data: {
      fees,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit
      }
    }
  });
});

const getStudentFees = asyncHandler(async (req, res) => {
  const { student_id } = req.params;

  // OPTIMIZED: Parallel fetch with Promise.all and lean()
  const [student, fees, summary] = await Promise.all([
    Student.findById(student_id)
      .populate('user_id', 'personal_info email')
      .populate('class_id', 'class_name grade section')
      .lean(),
    Fee.find({ student_id })
      .populate('created_by', 'personal_info')
      .sort({ due_date: -1 })
      .lean(),
    Fee.getStudentFeesSummary(new mongoose.Types.ObjectId(student_id))
  ]);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
      errors: ['No student found with this ID']
    });
  }

  const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const totalPaid = fees.reduce((sum, fee) => sum + fee.paid_amount, 0);
  const totalDue = totalAmount - totalPaid;

  res.status(200).json({
    success: true,
    message: 'Student fees retrieved successfully',
    data: {
      student,
      fees,
      summary: {
        by_status: summary,
        total_amount: totalAmount,
        total_paid: totalPaid,
        total_due: totalDue
      }
    }
  });
});

const createFee = asyncHandler(async (req, res) => {
  const {
    student_id,
    academic_year,
    term,
    fee_type,
    amount,
    due_date,
    description,
    notes
  } = req.body;

  const student = await Student.findById(student_id);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
      errors: ['Student does not exist']
    });
  }

  const fee = await Fee.create({
    student_id,
    academic_year,
    term,
    fee_type,
    amount,
    due_date,
    description,
    notes,
    created_by: req.user._id
  });

  await updateStudentFeeStatus(student_id);

  const populatedFee = await Fee.findById(fee._id)
    .populate({
      path: 'student_id',
      populate: {
        path: 'user_id',
        select: 'personal_info'
      }
    })
    .populate('created_by', 'personal_info');

  res.status(201).json({
    success: true,
    message: 'Fee created successfully',
    data: { fee: populatedFee }
  });
});

const recordPayment = asyncHandler(async (req, res) => {
  const { fee_id, amount, payment_method, transaction_id, notes } = req.body;

  const fee = await Fee.findById(fee_id);
  if (!fee) {
    return res.status(404).json({
      success: false,
      message: 'Fee not found',
      errors: ['Fee does not exist']
    });
  }

  if (fee.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Cannot record payment',
      errors: ['This fee has been cancelled']
    });
  }

  const remainingAmount = fee.amount - fee.paid_amount;
  if (amount > remainingAmount) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment amount',
      errors: [`Payment amount exceeds remaining balance of ${remainingAmount}`]
    });
  }

  fee.addPayment({
    amount,
    payment_method,
    transaction_id,
    received_by: req.user._id,
    notes
  });

  await fee.save();

  await updateStudentFeeStatus(fee.student_id);

  const updatedFee = await Fee.findById(fee._id)
    .populate({
      path: 'student_id',
      populate: {
        path: 'user_id',
        select: 'personal_info'
      }
    })
    .populate('created_by', 'personal_info')
    .populate('payments.received_by', 'personal_info');

  res.status(200).json({
    success: true,
    message: 'Payment recorded successfully',
    data: { fee: updatedFee }
  });
});

const getClassFeeReport = asyncHandler(async (req, res) => {
  const { class_id } = req.params;
  const { academic_year } = req.query;

  const classDoc = await Class.findById(class_id);
  if (!classDoc) {
    return res.status(404).json({
      success: false,
      message: 'Class not found',
      errors: ['Class does not exist']
    });
  }

  const year = academic_year || classDoc.academic_year;

  const report = await Fee.getClassFeeReport(
    new mongoose.Types.ObjectId(class_id),
    year
  );

  // OPTIMIZED: Single aggregation instead of N+1 queries
  const studentFees = await Student.aggregate([
    { $match: { class_id: new mongoose.Types.ObjectId(class_id) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'fees',
        let: { studentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$student_id', '$$studentId'] },
                  { $eq: ['$academic_year', year] }
                ]
              }
            }
          }
        ],
        as: 'fees'
      }
    },
    {
      $project: {
        student: {
          _id: '$_id',
          student_code: '$student_code',
          name: {
            $cond: {
              if: '$user',
              then: {
                $concat: [
                  { $ifNull: ['$user.personal_info.first_name', ''] },
                  ' ',
                  { $ifNull: ['$user.personal_info.last_name', ''] }
                ]
              },
              else: 'Unknown'
            }
          }
        },
        total_amount: { $sum: '$fees.amount' },
        total_paid: { $sum: '$fees.paid_amount' },
        balance: {
          $subtract: [
            { $sum: '$fees.amount' },
            { $sum: '$fees.paid_amount' }
          ]
        },
        fee_status: '$fee_status'
      }
    }
  ]);

  res.status(200).json({
    success: true,
    message: 'Class fee report retrieved successfully',
    data: {
      class: {
        _id: classDoc._id,
        class_name: classDoc.class_name,
        grade: classDoc.grade,
        section: classDoc.section
      },
      academic_year: year,
      summary: report,
      students: studentFees
    }
  });
});

const updateFee = asyncHandler(async (req, res) => {
  const { amount, due_date, description, notes, status } = req.body;

  const fee = await Fee.findById(req.params.id);
  if (!fee) {
    return res.status(404).json({
      success: false,
      message: 'Fee not found',
      errors: ['No fee found with this ID']
    });
  }

  if (fee.paid_amount > 0 && amount && amount < fee.paid_amount) {
    return res.status(400).json({
      success: false,
      message: 'Invalid amount',
      errors: ['New amount cannot be less than already paid amount']
    });
  }

  if (amount !== undefined) fee.amount = amount;
  if (due_date) fee.due_date = due_date;
  if (description !== undefined) fee.description = description;
  if (notes !== undefined) fee.notes = notes;
  if (status) fee.status = status;

  await fee.save();

  await updateStudentFeeStatus(fee.student_id);

  const updatedFee = await Fee.findById(fee._id)
    .populate({
      path: 'student_id',
      populate: {
        path: 'user_id',
        select: 'personal_info'
      }
    })
    .populate('created_by', 'personal_info');

  res.status(200).json({
    success: true,
    message: 'Fee updated successfully',
    data: { fee: updatedFee }
  });
});

const deleteFee = asyncHandler(async (req, res) => {
  const fee = await Fee.findById(req.params.id);

  if (!fee) {
    return res.status(404).json({
      success: false,
      message: 'Fee not found',
      errors: ['No fee found with this ID']
    });
  }

  if (fee.paid_amount > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete fee',
      errors: ['Cannot delete a fee with recorded payments. Cancel it instead.']
    });
  }

  const studentId = fee.student_id;

  await Fee.findByIdAndDelete(req.params.id);

  await updateStudentFeeStatus(studentId);

  res.status(200).json({
    success: true,
    message: 'Fee deleted successfully',
    data: null
  });
});

async function updateStudentFeeStatus(studentId) {
  const fees = await Fee.find({
    student_id: studentId,
    status: { $ne: 'cancelled' }
  });

  let newStatus = 'paid';

  for (const fee of fees) {
    if (fee.status === 'overdue') {
      newStatus = 'overdue';
      break;
    } else if (fee.status === 'partial') {
      newStatus = 'partial';
    } else if (fee.status === 'pending' && newStatus !== 'partial') {
      newStatus = 'pending';
    }
  }

  await Student.findByIdAndUpdate(studentId, { fee_status: newStatus });
}

/**
 * @desc    Create Stripe PaymentIntent for a fee
 * @route   POST /api/fees/:id/payment-intent
 * @access  Private
 */
const createPaymentIntent = asyncHandler(async (req, res) => {
  const fee = await Fee.findById(req.params.id);

  if (!fee) {
    return res.status(404).json({
      success: false,
      message: 'Fee not found',
      errors: ['No fee found with this ID']
    });
  }

  if (fee.status === 'paid' || fee.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Invalid fee status for payment',
      errors: [`Cannot pay for a fee that is already ${fee.status}`]
    });
  }

  const amountToPay = fee.amount - fee.paid_amount;
  if (amountToPay <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Fee already fully paid',
      errors: ['No outstanding balance for this fee']
    });
  }

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountToPay * 100), // Stripe expects amounts in cents
    currency: 'usd', // Adjust currency as needed
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      fee_id: fee._id.toString(),
      student_id: fee.student_id.toString()
    },
  });

  res.status(200).json({
    success: true,
    message: 'Payment intent created successfully',
    data: {
      clientSecret: paymentIntent.client_secret,
      amount: amountToPay
    }
  });
});

/**
 * @desc    Handle Stripe Webhook
 * @route   POST /api/fees/webhook
 * @access  Public
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody || req.body, // Use rawBody preserved in server.js
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const feeId = paymentIntent.metadata.fee_id;

    const fee = await Fee.findById(feeId);
    if (fee) {
      const amountPaid = paymentIntent.amount / 100;

      fee.addPayment({
        amount: amountPaid,
        payment_method: 'online',
        transaction_id: paymentIntent.id,
        received_by: null, // Online payment
        notes: `Stripe PaymentIntent: ${paymentIntent.id}`
      });

      await fee.save();
      await updateStudentFeeStatus(fee.student_id);

      console.log(`Payment Succeeded for fee: ${feeId}`);
    }
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

module.exports = {
  getFees,
  getStudentFees,
  createFee,
  recordPayment,
  getClassFeeReport,
  updateFee,
  deleteFee,
  createPaymentIntent,
  handleStripeWebhook
};
