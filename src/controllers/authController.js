const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Student, Teacher } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const sendEmail = require('../utils/sendEmail');
const { ROLES, JWT_EXPIRE } = require('../config/constants');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

const register = asyncHandler(async (req, res) => {
  const { username, email, password, personal_info } = req.body;

  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists',
      errors: [existingUser.email === email ? 'Email already in use' : 'Username already taken']
    });
  }

  const user = await User.create({
    username,
    email,
    password,
    role: ROLES.STUDENT,
    personal_info
  });

  // Auto-create student profile
  await Student.create({
    user_id: user._id,
    student_code: await Student.generateStudentCode()
  });

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: user.toJSON(),
      token
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
      errors: ['Email or password is incorrect']
    });
  }

  if (!user.is_active) {
    return res.status(401).json({
      success: false,
      message: 'Account deactivated',
      errors: ['Your account has been deactivated. Please contact admin.']
    });
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
      errors: ['Email or password is incorrect']
    });
  }

  await User.findByIdAndUpdate(user._id, { last_login: new Date() });

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.toJSON(),
      token
    }
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  let additionalData = {};

  if (user.role === ROLES.STUDENT) {
    const student = await Student.findOne({ user_id: user._id })
      .populate('class_id', 'class_name grade section academic_year');
    if (student) {
      additionalData.student = student;
    }
  } else if (user.role === ROLES.TEACHER) {
    const teacher = await Teacher.findOne({ user_id: user._id })
      .populate('subjects', 'subject_name subject_code');
    if (teacher) {
      additionalData.teacher = teacher;
    }
  }

  res.status(200).json({
    success: true,
    message: 'User profile retrieved',
    data: {
      user: user.toJSON(),
      ...additionalData
    }
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['personal_info'];
  const updates = {};

  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user }
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
      errors: ['Current password and new password are required']
    });
  }

  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid password',
      errors: ['Current password is incorrect']
    });
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    data: null
  });
});

const forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: ['There is no user with that email']
    });
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // Create reset URL - point to frontend client URL (default port 3000 locally)
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please use the following link to reset your password: \n\n ${resetUrl}`;
  const html = `
    <h1>Password Reset Request</h1>
    <p>You are receiving this email because you (or someone else) has requested the reset of a password.</p>
    <p>Please click on the following link to reset your password:</p>
    <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
    <p>If you did not request this, please ignore this email.</p>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Password Reset Token',
      message,
      html
    });

    res.status(200).json({
      success: true,
      data: 'Email sent'
    });
  } catch (err) {
    console.error('Email send error:', err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(err);
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid token',
      errors: ['Invalid or expired password reset token']
    });
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successful',
    data: {
      token: generateToken(user._id)
    }
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
};
