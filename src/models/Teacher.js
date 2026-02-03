const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true
  },
  teacher_code: {
    type: String,
    required: [true, 'Teacher code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  subjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  specialization: {
    type: String,
    trim: true
  },
  employment_date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave', 'terminated'],
    default: 'active'
  },
  qualifications: [{
    degree: { type: String, trim: true },
    institution: { type: String, trim: true },
    year: { type: Number }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

teacherSchema.index({ status: 1 });
teacherSchema.index({ subjects: 1 });

teacherSchema.virtual('class_subjects', {
  ref: 'ClassSubject',
  localField: '_id',
  foreignField: 'teachers.teacher_id'
});

teacherSchema.statics.generateTeacherCode = async function() {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await this.countDocuments() + 1;
  return `TCH${year}${count.toString().padStart(4, '0')}`;
};

module.exports = mongoose.model('Teacher', teacherSchema);
