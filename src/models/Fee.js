const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student is required']
  },
  academic_year: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  term: {
    type: String,
    enum: ['first', 'second', 'third'],
    required: [true, 'Term is required']
  },
  fee_type: {
    type: String,
    enum: ['tuition', 'transportation', 'books', 'uniform', 'activities', 'other'],
    required: [true, 'Fee type is required']
  },
  description: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  due_date: {
    type: Date,
    required: [true, 'Due date is required']
  },
  paid_amount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  payment_date: {
    type: Date
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'overdue', 'partial', 'cancelled'],
    default: 'pending'
  },
  payment_method: {
    type: String,
    enum: ['cash', 'bank_transfer', 'credit_card', 'check', 'online']
  },
  transaction_id: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  payments: [{
    amount: { type: Number, required: true },
    payment_date: { type: Date, default: Date.now },
    payment_method: { type: String, enum: ['cash', 'bank_transfer', 'credit_card', 'check', 'online'] },
    transaction_id: { type: String },
    received_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String }
  }]
}, {
  timestamps: true
});

feeSchema.index({ student_id: 1 });
feeSchema.index({ academic_year: 1 });
feeSchema.index({ due_date: 1 });
feeSchema.index({ status: 1 });
feeSchema.index({ student_id: 1, academic_year: 1 });
feeSchema.index({ fee_type: 1 });

feeSchema.pre('save', function(next) {
  this.updateStatus();
  next();
});

feeSchema.methods.updateStatus = function() {
  if (this.status === 'cancelled') return;
  
  if (this.paid_amount >= this.amount) {
    this.status = 'paid';
  } else if (this.paid_amount > 0 && this.paid_amount < this.amount) {
    this.status = 'partial';
  } else if (new Date() > this.due_date) {
    this.status = 'overdue';
  } else {
    this.status = 'pending';
  }
};

feeSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.paid_amount = this.payments.reduce((sum, p) => sum + p.amount, 0);
  if (this.paid_amount >= this.amount) {
    this.payment_date = new Date();
    this.payment_method = paymentData.payment_method;
    this.transaction_id = paymentData.transaction_id;
  }
  this.updateStatus();
};

feeSchema.statics.getStudentFeesSummary = async function(studentId) {
  return await this.aggregate([
    { $match: { student_id: studentId } },
    {
      $group: {
        _id: '$status',
        total_amount: { $sum: '$amount' },
        total_paid: { $sum: '$paid_amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

feeSchema.statics.getClassFeeReport = async function(classId, academicYear) {
  const Student = mongoose.model('Student');
  const students = await Student.find({ class_id: classId }).select('_id');
  const studentIds = students.map(s => s._id);
  
  return await this.aggregate([
    { 
      $match: { 
        student_id: { $in: studentIds },
        academic_year: academicYear 
      } 
    },
    {
      $group: {
        _id: '$status',
        total_amount: { $sum: '$amount' },
        total_paid: { $sum: '$paid_amount' },
        count: { $sum: 1 },
        students: { $addToSet: '$student_id' }
      }
    },
    {
      $project: {
        status: '$_id',
        total_amount: 1,
        total_paid: 1,
        count: 1,
        student_count: { $size: '$students' }
      }
    }
  ]);
};

feeSchema.statics.updateOverdueFees = async function() {
  const now = new Date();
  return await this.updateMany(
    { 
      status: 'pending', 
      due_date: { $lt: now },
      paid_amount: { $lt: { $ifNull: ['$amount', 0] } }
    },
    { $set: { status: 'overdue' } }
  );
};

module.exports = mongoose.model('Fee', feeSchema);
