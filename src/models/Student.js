const mongoose = require('mongoose');

const parentDetailSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  occupation: { type: String, trim: true }
}, { _id: false });

const guardianSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  relation: { type: String, trim: true }
}, { _id: false });

const parentInfoSchema = new mongoose.Schema({
  father: parentDetailSchema,
  mother: parentDetailSchema,
  guardian: guardianSchema
}, { _id: false });

const studentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true
  },
  student_code: {
    type: String,
    required: [true, 'Student code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  class_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  enrollment_date: {
    type: Date,
    default: Date.now
  },
  parent_info: parentInfoSchema,
  academic_status: {
    type: String,
    enum: ['active', 'transferred', 'graduated', 'suspended'],
    default: 'active'
  },
  fee_status: {
    type: String,
    enum: ['paid', 'pending', 'overdue', 'partial'],
    default: 'overdue'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

studentSchema.index({ class_id: 1 });
studentSchema.index({ academic_status: 1 });
studentSchema.index({ fee_status: 1 });

studentSchema.virtual('absences', {
  ref: 'Absence',
  localField: '_id',
  foreignField: 'student_id'
});

studentSchema.virtual('fees', {
  ref: 'Fee',
  localField: '_id',
  foreignField: 'student_id'
});

studentSchema.statics.generateStudentCode = async function () {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await this.countDocuments() + 1;
  return `STU${year}${count.toString().padStart(5, '0')}`;
};

module.exports = mongoose.model('Student', studentSchema);
