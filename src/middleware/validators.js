const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => err.msg)
    });
  }
  next();
};

const authValidators = {
  register: [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
      .escape(),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email'),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('personal_info.first_name')
      .trim()
      .notEmpty().withMessage('First name is required')
      .escape(),
    body('personal_info.last_name')
      .trim()
      .notEmpty().withMessage('Last name is required')
      .escape(),
    validate
  ],
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email'),
    body('password')
      .notEmpty().withMessage('Password is required'),
    validate
  ]
};

const studentValidators = {
  create: [
    body('user_id')
      .notEmpty().withMessage('User ID is required')
      .isMongoId().withMessage('Invalid User ID'),
    body('class_id')
      .notEmpty().withMessage('Class ID is required')
      .isMongoId().withMessage('Invalid Class ID'),
    body('student_code')
      .optional()
      .trim()
      .isLength({ min: 3 }).withMessage('Student code must be at least 3 characters')
      .escape(),
    validate
  ],
  update: [
    param('id')
      .isMongoId().withMessage('Invalid student ID'),
    body('class_id')
      .optional()
      .isMongoId().withMessage('Invalid Class ID'),
    body('academic_status')
      .optional()
      .isIn(['active', 'transferred', 'graduated', 'suspended'])
      .withMessage('Invalid academic status'),
    body('fee_status')
      .optional()
      .isIn(['paid', 'pending', 'overdue', 'partial'])
      .withMessage('Invalid fee status'),
    validate
  ]
};

const teacherValidators = {
  create: [
    body('user_id')
      .notEmpty().withMessage('User ID is required')
      .isMongoId().withMessage('Invalid User ID'),
    body('specialization')
      .optional()
      .trim()
      .escape(),
    validate
  ],
  update: [
    param('id')
      .isMongoId().withMessage('Invalid teacher ID'),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'on_leave', 'terminated'])
      .withMessage('Invalid status'),
    validate
  ]
};

const classValidators = {
  create: [
    body('class_name')
      .trim()
      .notEmpty().withMessage('Class name is required')
      .escape(),
    body('grade')
      .notEmpty().withMessage('Grade is required')
      .isInt({ min: 1, max: 12 }).withMessage('Grade must be between 1 and 12'),
    body('section')
      .trim()
      .notEmpty().withMessage('Section is required')
      .escape(),
    body('academic_year')
      .trim()
      .notEmpty().withMessage('Academic year is required')
      .escape(),
    body('capacity')
      .optional()
      .isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    body('room_number')
      .optional()
      .trim()
      .escape(),
    validate
  ],
  update: [
    param('id')
      .isMongoId().withMessage('Invalid class ID'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Invalid status'),
    validate
  ]
};

const subjectValidators = {
  create: [
    body('subject_name')
      .trim()
      .notEmpty().withMessage('Subject name is required')
      .escape(),
    body('subject_code')
      .optional()
      .trim()
      .escape(),
    body('credits')
      .optional()
      .isInt({ min: 0 }).withMessage('Credits must be non-negative'),
    body('category')
      .optional()
      .isIn(['core', 'elective', 'extracurricular'])
      .withMessage('Invalid category'),
    validate
  ],
  update: [
    param('id')
      .isMongoId().withMessage('Invalid subject ID'),
    validate
  ]
};

const feeValidators = {
  create: [
    body('student_id')
      .notEmpty().withMessage('Student ID is required')
      .isMongoId().withMessage('Invalid Student ID'),
    body('academic_year')
      .trim()
      .notEmpty().withMessage('Academic year is required')
      .escape(),
    body('term')
      .notEmpty().withMessage('Term is required')
      .isIn(['first', 'second', 'third']).withMessage('Invalid term'),
    body('fee_type')
      .notEmpty().withMessage('Fee type is required')
      .isIn(['tuition', 'transportation', 'books', 'uniform', 'activities', 'other'])
      .withMessage('Invalid fee type'),
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0 }).withMessage('Amount must be non-negative'),
    body('due_date')
      .notEmpty().withMessage('Due date is required')
      .isISO8601().withMessage('Invalid date format'),
    validate
  ],
  payment: [
    body('fee_id')
      .notEmpty().withMessage('Fee ID is required')
      .isMongoId().withMessage('Invalid Fee ID'),
    body('amount')
      .notEmpty().withMessage('Payment amount is required')
      .isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
    body('payment_method')
      .notEmpty().withMessage('Payment method is required')
      .isIn(['cash', 'bank_transfer', 'credit_card', 'check', 'online'])
      .withMessage('Invalid payment method'),
    validate
  ]
};

const absenceValidators = {
  create: [
    body('student_id')
      .notEmpty().withMessage('Student ID is required')
      .isMongoId().withMessage('Invalid Student ID'),
    body('class_subject_id')
      .optional({ checkFalsy: true })
      .isMongoId().withMessage('Invalid Class Subject ID'),
    body('date')
      .notEmpty().withMessage('Date is required')
      .isISO8601().withMessage('Invalid date format'),
    body('session')
      .optional()
      .isIn(['morning', 'afternoon'])
      .withMessage('Invalid session'),
    body('period')
      .optional()
      .isIn(['full_day', 'first_period', 'second_period', 'third_period', 'fourth_period', 'fifth_period'])
      .withMessage('Invalid period'),
    body('reason')
      .optional()
      .isIn(['sickness', 'family', 'vacation', 'other'])
      .withMessage('Invalid reason'),
    body('reason_details')
      .optional()
      .trim()
      .escape(),
    validate
  ],
  update: [
    param('id')
      .isMongoId().withMessage('Invalid absence ID'),
    body('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected'])
      .withMessage('Invalid status'),
    validate
  ]
};

const scheduleValidators = {
  create: [
    body('class_id')
      .notEmpty().withMessage('Class ID is required')
      .isMongoId().withMessage('Invalid Class ID'),
    body('subject_id')
      .notEmpty().withMessage('Subject ID is required')
      .isMongoId().withMessage('Invalid Subject ID'),
    body('teacher_id')
      .notEmpty().withMessage('Teacher ID is required')
      .isMongoId().withMessage('Invalid Teacher ID'),
    body('day')
      .notEmpty().withMessage('Day is required')
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
      .withMessage('Invalid day'),
    body('start_time')
      .notEmpty().withMessage('Start time is required')
      .matches(/^([01]\d|2[0-3]):?([0-5]\d)$/).withMessage('Start time must be in HH:MM format'),
    body('end_time')
      .notEmpty().withMessage('End time is required')
      .matches(/^([01]\d|2[0-3]):?([0-5]\d)$/).withMessage('End time must be in HH:MM format'),
    body('room')
      .optional()
      .trim()
      .escape(),
    body('academic_year')
      .trim()
      .notEmpty().withMessage('Academic year is required')
      .escape(),
    validate
  ],
  update: [
    param('id')
      .isMongoId().withMessage('Invalid schedule ID'),
    body('day')
      .optional()
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
    body('start_time')
      .optional()
      .matches(/^([01]\d|2[0-3]):?([0-5]\d)$/),
    body('end_time')
      .optional()
      .matches(/^([01]\d|2[0-3]):?([0-5]\d)$/),
    body('room')
      .optional()
      .trim()
      .escape(),
    validate
  ]
};

const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  validate
];

const mongoIdValidator = [
  param('id')
    .isMongoId().withMessage('Invalid ID format'),
  validate
];

module.exports = {
  validate,
  authValidators,
  studentValidators,
  teacherValidators,
  classValidators,
  subjectValidators,
  feeValidators,
  absenceValidators,
  scheduleValidators,
  paginationValidator,
  mongoIdValidator
};
