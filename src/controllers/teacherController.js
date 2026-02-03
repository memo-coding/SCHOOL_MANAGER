const { User, Teacher, Subject, ClassSubject } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { PAGINATION, ROLES } = require('../config/constants');

const getTeachers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = {};
  
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.subject_id) {
    filter.subjects = req.query.subject_id;
  }

  const [teachers, total] = await Promise.all([
    Teacher.find(filter)
      .populate('user_id', 'username email personal_info is_active')
      .populate('subjects', 'subject_name subject_code')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Teacher.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    message: 'Teachers retrieved successfully',
    data: {
      teachers,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit
      }
    }
  });
});

const getTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id)
    .populate('user_id', 'username email personal_info is_active')
    .populate('subjects', 'subject_name subject_code credits');

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found',
      errors: ['No teacher found with this ID']
    });
  }

  const classSubjects = await ClassSubject.find({
    'teachers.teacher_id': teacher._id,
    status: 'active'
  })
    .populate('class_id', 'class_name grade section academic_year')
    .populate('subject_id', 'subject_name subject_code');

  res.status(200).json({
    success: true,
    message: 'Teacher retrieved successfully',
    data: { 
      teacher,
      assigned_classes: classSubjects
    }
  });
});

const createTeacher = asyncHandler(async (req, res) => {
  const { user_id, teacher_code, subjects, specialization, employment_date, qualifications } = req.body;

  const user = await User.findById(user_id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: ['User does not exist']
    });
  }

  if (user.role !== ROLES.TEACHER) {
    user.role = ROLES.TEACHER;
    await user.save({ validateBeforeSave: false });
  }

  const existingTeacher = await Teacher.findOne({ user_id });
  if (existingTeacher) {
    return res.status(400).json({
      success: false,
      message: 'Teacher already exists',
      errors: ['This user is already registered as a teacher']
    });
  }

  if (subjects && subjects.length > 0) {
    const validSubjects = await Subject.find({ _id: { $in: subjects } });
    if (validSubjects.length !== subjects.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subjects',
        errors: ['One or more subjects do not exist']
      });
    }
  }

  const generatedCode = teacher_code || await Teacher.generateTeacherCode();

  const teacher = await Teacher.create({
    user_id,
    teacher_code: generatedCode,
    subjects: subjects || [],
    specialization,
    employment_date,
    qualifications
  });

  const populatedTeacher = await Teacher.findById(teacher._id)
    .populate('user_id', 'username email personal_info')
    .populate('subjects', 'subject_name subject_code');

  res.status(201).json({
    success: true,
    message: 'Teacher created successfully',
    data: { teacher: populatedTeacher }
  });
});

const updateTeacher = asyncHandler(async (req, res) => {
  const { subjects, specialization, status, qualifications } = req.body;

  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found',
      errors: ['No teacher found with this ID']
    });
  }

  if (subjects) {
    const validSubjects = await Subject.find({ _id: { $in: subjects } });
    if (validSubjects.length !== subjects.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subjects',
        errors: ['One or more subjects do not exist']
      });
    }
    teacher.subjects = subjects;
  }
  if (specialization !== undefined) teacher.specialization = specialization;
  if (status) teacher.status = status;
  if (qualifications) teacher.qualifications = qualifications;

  await teacher.save();

  const updatedTeacher = await Teacher.findById(teacher._id)
    .populate('user_id', 'username email personal_info')
    .populate('subjects', 'subject_name subject_code');

  res.status(200).json({
    success: true,
    message: 'Teacher updated successfully',
    data: { teacher: updatedTeacher }
  });
});

const deleteTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id);
  
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found',
      errors: ['No teacher found with this ID']
    });
  }

  const assignedClasses = await ClassSubject.countDocuments({
    'teachers.teacher_id': teacher._id,
    status: 'active'
  });

  if (assignedClasses > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete teacher',
      errors: ['Teacher is assigned to active classes. Remove assignments first.']
    });
  }

  await Teacher.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Teacher deleted successfully',
    data: null
  });
});

module.exports = {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher
};
