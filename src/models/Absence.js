const mongoose = require('mongoose');

const absenceSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student is required']
  },
  class_subject_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSubject',
    required: false
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  session: {
    type: String,
    enum: ['morning', 'afternoon'],
    default: 'morning'
  },
  period: {
    type: String,
    enum: ['full_day', 'first_period', 'second_period', 'third_period', 'fourth_period'],
    default: 'full_day'
  },
  reason: {
    type: String,
    enum: ['sickness', 'family', 'vacation', 'other'],
    default: 'other'
  },
  reason_details: {
    type: String,
    trim: true
  },
  reported_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reporter is required']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

absenceSchema.index({ student_id: 1 });
absenceSchema.index({ date: 1 });
absenceSchema.index({ class_subject_id: 1 });
absenceSchema.index({ status: 1 });
absenceSchema.index({ student_id: 1, date: 1 });
absenceSchema.index({ student_id: 1, status: 1 });
absenceSchema.index({ reported_by: 1 });

absenceSchema.statics.getAbsenceCount = async function (studentId, startDate, endDate) {
  const match = { student_id: studentId, status: 'approved' };
  if (startDate && endDate) {
    match.date = { $gte: startDate, $lte: endDate };
  }

  const result = await this.aggregate([
    { $match: match },
    { $group: { _id: null, count: { $sum: 1 } } }
  ]);

  return result.length > 0 ? result[0].count : 0;
};

absenceSchema.statics.getAbsenceBySubject = async function (studentId) {
  return await this.aggregate([
    { $match: { student_id: studentId, status: 'approved' } },
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
  ]);
};

module.exports = mongoose.model('Absence', absenceSchema);
