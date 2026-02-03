const { Class, Teacher, Student, ClassSubject } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { PAGINATION } = require('../config/constants');

const getClasses = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.grade) {
    filter.grade = req.query.grade;
  }
  if (req.query.academic_year) {
    filter.academic_year = req.query.academic_year;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [classes, total] = await Promise.all([
    Class.find(filter)
      .populate('head_teacher', 'teacher_code')
      .skip(skip)
      .limit(limit)
      .sort({ grade: 1, section: 1 }),
    Class.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    message: 'Classes retrieved successfully',
    data: {
      classes,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit
      }
    }
  });
});

const getClass = asyncHandler(async (req, res) => {
  const classDoc = await Class.findById(req.params.id)
    .populate({
      path: 'head_teacher',
      populate: {
        path: 'user_id',
        select: 'personal_info email'
      }
    });

  if (!classDoc) {
    return res.status(404).json({
      success: false,
      message: 'Class not found',
      errors: ['No class found with this ID']
    });
  }

  const [students, classSubjects] = await Promise.all([
    Student.find({ class_id: classDoc._id, academic_status: 'active' })
      .populate('user_id', 'personal_info email')
      .select('student_code academic_status fee_status'),
    ClassSubject.find({ class_id: classDoc._id, status: 'active' })
      .populate('subject_id', 'subject_name subject_code credits')
      .populate({
        path: 'teachers.teacher_id',
        populate: {
          path: 'user_id',
          select: 'personal_info'
        }
      })
  ]);

  res.status(200).json({
    success: true,
    message: 'Class retrieved successfully',
    data: {
      class: classDoc,
      students,
      subjects: classSubjects
    }
  });
});

const createClass = asyncHandler(async (req, res) => {
  const { class_name, grade, section, academic_year, capacity, head_teacher, room_number, subject_ids } = req.body;

  const existingClass = await Class.findOne({ grade, section, academic_year });
  if (existingClass) {
    return res.status(400).json({
      success: false,
      message: 'Class already exists',
      errors: ['A class with this grade, section, and academic year already exists']
    });
  }

  if (head_teacher) {
    const teacher = await Teacher.findById(head_teacher);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
        errors: ['Head teacher does not exist']
      });
    }
  }

  const newClass = await Class.create({
    class_name,
    grade,
    section,
    academic_year,
    capacity: capacity || 30,
    head_teacher,
    room_number
  });

  // Handle initial subject assignment
  if (Array.isArray(subject_ids) && subject_ids.length > 0) {
    const classSubjects = subject_ids.map(subjectId => ({
      class_id: newClass._id,
      subject_id: subjectId,
      academic_year: academic_year,
      status: 'active'
    }));
    await ClassSubject.insertMany(classSubjects);
  }

  const populatedClass = await Class.findById(newClass._id)
    .populate('head_teacher', 'teacher_code');

  res.status(201).json({
    success: true,
    message: 'Class created successfully',
    data: { class: populatedClass }
  });
});

const updateClass = asyncHandler(async (req, res) => {
  const { class_name, capacity, head_teacher, room_number, status } = req.body;

  const classDoc = await Class.findById(req.params.id);
  if (!classDoc) {
    return res.status(404).json({
      success: false,
      message: 'Class not found',
      errors: ['No class found with this ID']
    });
  }

  if (head_teacher) {
    const teacher = await Teacher.findById(head_teacher);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
        errors: ['Head teacher does not exist']
      });
    }
    classDoc.head_teacher = head_teacher;
  }

  if (class_name) classDoc.class_name = class_name;
  if (capacity) classDoc.capacity = capacity;
  if (room_number !== undefined) classDoc.room_number = room_number;
  if (status) classDoc.status = status;

  await classDoc.save();

  const updatedClass = await Class.findById(classDoc._id)
    .populate('head_teacher', 'teacher_code');

  res.status(200).json({
    success: true,
    message: 'Class updated successfully',
    data: { class: updatedClass }
  });
});

const deleteClass = asyncHandler(async (req, res) => {
  const classDoc = await Class.findById(req.params.id);

  if (!classDoc) {
    return res.status(404).json({
      success: false,
      message: 'Class not found',
      errors: ['No class found with this ID']
    });
  }

  const activeStudents = await Student.countDocuments({
    class_id: classDoc._id,
    academic_status: 'active'
  });

  if (activeStudents > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete class',
      errors: ['Class has active students. Transfer or remove students first.']
    });
  }

  await ClassSubject.deleteMany({ class_id: classDoc._id });

  await Class.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Class deleted successfully',
    data: null
  });
});

module.exports = {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass
};
