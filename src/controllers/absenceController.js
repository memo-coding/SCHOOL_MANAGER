const mongoose = require('mongoose');
const { Absence, Student, ClassSubject } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { PAGINATION } = require('../config/constants');

const getAbsences = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.student_id) {
    filter.student_id = req.query.student_id;
  }
  if (req.query.class_subject_id) {
    filter.class_subject_id = req.query.class_subject_id;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.date) {
    filter.date = new Date(req.query.date);
  }
  if (req.query.from_date && req.query.to_date) {
    filter.date = {
      $gte: new Date(req.query.from_date),
      $lte: new Date(req.query.to_date)
    };
  }

  const pipeline = [
    { $match: filter },
    { $sort: { date: -1 } },
    {
      $facet: {
        absences: [
          { $skip: skip },
          { $limit: limit },
          // Lookup for student_id
          {
            $lookup: {
              from: 'students',
              localField: 'student_id',
              foreignField: '_id',
              as: 'student_id'
            }
          },
          { $unwind: { path: '$student_id', preserveNullAndEmptyArrays: true } },
          // Lookup for user_id within student
          {
            $lookup: {
              from: 'users',
              localField: 'student_id.user_id',
              foreignField: '_id',
              as: 'student_id.user_id'
            }
          },
          { $unwind: { path: '$student_id.user_id', preserveNullAndEmptyArrays: true } },
          // Lookup for class_subject_id
          {
            $lookup: {
              from: 'classsubjects',
              localField: 'class_subject_id',
              foreignField: '_id',
              as: 'class_subject_id'
            }
          },
          { $unwind: { path: '$class_subject_id', preserveNullAndEmptyArrays: true } },
          // Lookup for class_id within class_subject
          {
            $lookup: {
              from: 'classes',
              localField: 'class_subject_id.class_id',
              foreignField: '_id',
              as: 'class_subject_id.class_id'
            }
          },
          { $unwind: { path: '$class_subject_id.class_id', preserveNullAndEmptyArrays: true } },
          // Lookup for subject_id within class_subject
          {
            $lookup: {
              from: 'subjects',
              localField: 'class_subject_id.subject_id',
              foreignField: '_id',
              as: 'class_subject_id.subject_id'
            }
          },
          { $unwind: { path: '$class_subject_id.subject_id', preserveNullAndEmptyArrays: true } },
          // Lookup for reported_by
          {
            $lookup: {
              from: 'users',
              localField: 'reported_by',
              foreignField: '_id',
              as: 'reported_by'
            }
          },
          { $unwind: { path: '$reported_by', preserveNullAndEmptyArrays: true } },
          // Lookup for approved_by
          {
            $lookup: {
              from: 'users',
              localField: 'approved_by',
              foreignField: '_id',
              as: 'approved_by'
            }
          },
          { $unwind: { path: '$approved_by', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              'student_id.user_id.password': 0,
              'reported_by.password': 0,
              'approved_by.password': 0
            }
          }
        ],
        totalCount: [
          { $count: "count" }
        ]
      }
    }
  ];

  const [result] = await Absence.aggregate(pipeline);
  const absences = result.absences || [];
  const total = result.totalCount[0]?.count || 0;

  res.status(200).json({
    success: true,
    message: 'Absences retrieved successfully',
    data: {
      absences,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit
      }
    }
  });
});

const getAbsence = asyncHandler(async (req, res) => {
  const absence = await Absence.findById(req.params.id)
    .populate({
      path: 'student_id',
      populate: [
        { path: 'user_id', select: 'personal_info email' },
        { path: 'class_id', select: 'class_name grade section' }
      ]
    })
    .populate({
      path: 'class_subject_id',
      populate: [
        { path: 'class_id', select: 'class_name grade section' },
        { path: 'subject_id', select: 'subject_name subject_code' }
      ]
    })
    .populate('reported_by', 'personal_info role')
    .populate('approved_by', 'personal_info');

  if (!absence) {
    return res.status(404).json({
      success: false,
      message: 'Absence not found',
      errors: ['No absence record found with this ID']
    });
  }

  res.status(200).json({
    success: true,
    message: 'Absence retrieved successfully',
    data: { absence }
  });
});

const createAbsence = asyncHandler(async (req, res) => {
  const {
    student_id,
    class_subject_id,
    date,
    session,
    period,
    reason,
    reason_details,
    notes
  } = req.body;

  const [student, classSubject] = await Promise.all([
    Student.findById(student_id),
    ClassSubject.findById(class_subject_id)
  ]);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
      errors: ['Student does not exist']
    });
  }

  if (!classSubject) {
    return res.status(404).json({
      success: false,
      message: 'Class subject not found',
      errors: ['Class subject does not exist']
    });
  }

  if (student.class_id.toString() !== classSubject.class_id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid class subject',
      errors: ['This subject is not assigned to the student\'s class']
    });
  }

  const existingAbsence = await Absence.findOne({
    student_id,
    class_subject_id,
    date: new Date(date),
    session: session || 'morning',
    period: period || 'full_day'
  });

  if (existingAbsence) {
    return res.status(400).json({
      success: false,
      message: 'Absence already recorded',
      errors: ['An absence record already exists for this student, subject, and time slot']
    });
  }

  const absence = await Absence.create({
    student_id,
    class_subject_id,
    date,
    session: session || 'morning',
    period: period || 'full_day',
    reason: reason || 'other',
    reason_details,
    reported_by: req.user._id,
    notes
  });

  const populatedAbsence = await Absence.findById(absence._id)
    .populate({
      path: 'student_id',
      populate: {
        path: 'user_id',
        select: 'personal_info'
      }
    })
    .populate({
      path: 'class_subject_id',
      populate: [
        { path: 'class_id', select: 'class_name grade section' },
        { path: 'subject_id', select: 'subject_name subject_code' }
      ]
    })
    .populate('reported_by', 'personal_info');

  res.status(201).json({
    success: true,
    message: 'Absence recorded successfully',
    data: { absence: populatedAbsence }
  });
});

const updateAbsence = asyncHandler(async (req, res) => {
  const { status, reason, reason_details, notes } = req.body;

  const absence = await Absence.findById(req.params.id);
  if (!absence) {
    return res.status(404).json({
      success: false,
      message: 'Absence not found',
      errors: ['No absence record found with this ID']
    });
  }

  if (status && ['approved', 'rejected'].includes(status)) {
    absence.status = status;
    absence.approved_by = req.user._id;
    absence.approved_at = new Date();
  }
  if (reason) absence.reason = reason;
  if (reason_details !== undefined) absence.reason_details = reason_details;
  if (notes !== undefined) absence.notes = notes;

  await absence.save();

  const updatedAbsence = await Absence.findById(absence._id)
    .populate({
      path: 'student_id',
      populate: {
        path: 'user_id',
        select: 'personal_info'
      }
    })
    .populate({
      path: 'class_subject_id',
      populate: [
        { path: 'class_id', select: 'class_name grade section' },
        { path: 'subject_id', select: 'subject_name subject_code' }
      ]
    })
    .populate('reported_by', 'personal_info')
    .populate('approved_by', 'personal_info');

  res.status(200).json({
    success: true,
    message: 'Absence updated successfully',
    data: { absence: updatedAbsence }
  });
});

const deleteAbsence = asyncHandler(async (req, res) => {
  const absence = await Absence.findById(req.params.id);

  if (!absence) {
    return res.status(404).json({
      success: false,
      message: 'Absence not found',
      errors: ['No absence record found with this ID']
    });
  }

  await Absence.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Absence deleted successfully',
    data: null
  });
});

const getStudentAbsenceReport = asyncHandler(async (req, res) => {
  const { student_id } = req.params;
  const { from_date, to_date } = req.query;

  const student = await Student.findById(student_id)
    .populate('user_id', 'personal_info email')
    .populate('class_id', 'class_name grade section academic_year');

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
      errors: ['No student found with this ID']
    });
  }

  const dateFilter = {};
  if (from_date) dateFilter.$gte = new Date(from_date);
  if (to_date) dateFilter.$lte = new Date(to_date);

  const absenceQuery = {
    student_id: new mongoose.Types.ObjectId(student_id),
    status: 'approved'
  };
  if (Object.keys(dateFilter).length > 0) {
    absenceQuery.date = dateFilter;
  }

  const [reportResult] = await Absence.aggregate([
    { $match: absenceQuery },
    {
      $facet: {
        total_absences: [{ $count: "count" }],
        by_reason: [
          { $group: { _id: '$reason', count: { $sum: 1 } } }
        ],
        recent: [
          { $sort: { date: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'classsubjects',
              localField: 'class_subject_id',
              foreignField: '_id',
              as: 'class_subject_id'
            }
          },
          { $unwind: { path: '$class_subject_id', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'subjects',
              localField: 'class_subject_id.subject_id',
              foreignField: '_id',
              as: 'class_subject_id.subject_id'
            }
          },
          { $unwind: { path: '$class_subject_id.subject_id', preserveNullAndEmptyArrays: true } }
        ],
        by_subject: [
          {
            $group: {
              _id: '$class_subject_id',
              count: { $sum: 1 },
              dates: { $push: '$date' }
            }
          },
          {
            $lookup: {
              from: 'classsubjects',
              localField: '_id',
              foreignField: '_id',
              as: 'class_subject'
            }
          },
          { $unwind: { path: '$class_subject', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'subjects',
              localField: 'class_subject.subject_id',
              foreignField: '_id',
              as: 'subject'
            }
          },
          { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              subject_name: { $ifNull: ['$subject.subject_name', 'General'] },
              subject_code: { $ifNull: ['$subject.subject_code', 'GEN'] },
              count: 1,
              dates: 1
            }
          }
        ]
      }
    }
  ]);

  const totalCount = reportResult.total_absences[0]?.count || 0;
  const bySubject = reportResult.by_subject || [];
  const byReason = reportResult.by_reason || [];
  const recentAbsences = reportResult.recent || [];

  res.status(200).json({
    success: true,
    message: 'Student absence report retrieved successfully',
    data: {
      student,
      report: {
        total_absences: totalCount,
        by_subject: bySubject,
        by_reason: byReason,
        recent: recentAbsences
      }
    }
  });
});

module.exports = {
  getAbsences,
  getAbsence,
  createAbsence,
  updateAbsence,
  deleteAbsence,
  getStudentAbsenceReport
};
