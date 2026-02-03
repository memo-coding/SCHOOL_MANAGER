const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  subject_name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  subject_code: {
    type: String,
    required: [true, 'Subject code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  credits: {
    type: Number,
    default: 1,
    min: [0, 'Credits cannot be negative']
  },
  category: {
    type: String,
    enum: ['core', 'elective', 'extracurricular'],
    default: 'core'
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

subjectSchema.index({ category: 1 });
subjectSchema.index({ status: 1 });

subjectSchema.virtual('class_subjects', {
  ref: 'ClassSubject',
  localField: '_id',
  foreignField: 'subject_id'
});

subjectSchema.statics.generateSubjectCode = async function(name) {
  const prefix = name.substring(0, 3).toUpperCase();
  const count = await this.countDocuments() + 1;
  return `${prefix}${count.toString().padStart(3, '0')}`;
};

module.exports = mongoose.model('Subject', subjectSchema);
