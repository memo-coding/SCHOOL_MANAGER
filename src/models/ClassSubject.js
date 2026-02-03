const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  start_time: {
    type: String,
    required: true
  },
  end_time: {
    type: String,
    required: true
  },
  room: {
    type: String,
    trim: true
  }
}, { _id: false });

const teacherAssignmentSchema = new mongoose.Schema({
  teacher_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  is_primary: {
    type: Boolean,
    default: false
  },
  schedule: [scheduleSchema]
}, { _id: false });

const classSubjectSchema = new mongoose.Schema({
  class_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },
  subject_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject is required']
  },
  teachers: [teacherAssignmentSchema],
  academic_year: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

classSubjectSchema.index({ class_id: 1, subject_id: 1, academic_year: 1 }, { unique: true });
classSubjectSchema.index({ class_id: 1 });
classSubjectSchema.index({ subject_id: 1 });
classSubjectSchema.index({ 'teachers.teacher_id': 1 });
classSubjectSchema.index({ academic_year: 1 });
classSubjectSchema.index({ status: 1 });

classSubjectSchema.virtual('absences', {
  ref: 'Absence',
  localField: '_id',
  foreignField: 'class_subject_id'
});

module.exports = mongoose.model('ClassSubject', classSubjectSchema);
