const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const phoneSchema = new mongoose.Schema({
  number: { type: String, trim: true },
  type: { type: String, enum: ['mobile', 'home', 'work'], default: 'mobile' }
}, { _id: false });

const addressSchema = new mongoose.Schema({
  address_line: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  postal_code: { type: String, trim: true },
  type: { type: String, enum: ['home', 'work', 'billing'], default: 'home' }
}, { _id: false });

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  relation: { type: String, trim: true },
  phone: { type: String, trim: true }
}, { _id: false });

const personalInfoSchema = new mongoose.Schema({
  first_name: { type: String, required: true, trim: true },
  last_name: { type: String, required: true, trim: true },
  phones: [phoneSchema],
  addresses: [addressSchema],
  gender: { type: String, enum: ['male', 'female'] },
  national_id: { type: String, trim: true },
  emergency_contact: emergencyContactSchema
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'teacher', 'student'],
    default: 'student'
  },
  personal_info: {
    type: personalInfoSchema,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  last_login: {
    type: Date
  },
  last_schedule_viewed: {
    type: Date,
    default: new Date(0) // Default to 1970-01-01
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true
});

userSchema.index({ role: 1 });
userSchema.index({ is_active: 1 });
userSchema.index({ 'personal_info.first_name': 1 });
userSchema.index({ 'personal_info.last_name': 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  return obj;
};

userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
