const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  class_name: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true
  },
  grade: {
    type: Number,
    required: [true, 'Grade is required'],
    min: [1, 'Grade must be at least 1'],
    max: [12, 'Grade cannot exceed 12']
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true,
    uppercase: true
  },
  academic_year: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1'],
    default: 30
  },
  current_students: {
    type: Number,
    default: 0,
    min: 0
  },
  head_teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  room_number: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  last_schedule_update: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

classSchema.index({ grade: 1, section: 1, academic_year: 1 }, { unique: true });
classSchema.index({ academic_year: 1 });
classSchema.index({ status: 1 });
classSchema.index({ head_teacher: 1 });

classSchema.virtual('students', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'class_id'
});

classSchema.virtual('class_subjects', {
  ref: 'ClassSubject',
  localField: '_id',
  foreignField: 'class_id'
});

classSchema.methods.updateStudentCount = async function () {
  const Student = mongoose.model('Student');
  this.current_students = await Student.countDocuments({
    class_id: this._id,
    academic_status: 'active'
  });
  await this.save();
};

module.exports = mongoose.model('Class', classSchema);
