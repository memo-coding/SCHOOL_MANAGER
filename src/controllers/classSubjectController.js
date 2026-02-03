const { ClassSubject, Class, Subject, Teacher } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { PAGINATION } = require('../config/constants');

const getClassSubjects = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = {};
  
  if (req.query.class_id) {
    filter.class_id = req.query.class_id;
  }
  if (req.query.subject_id) {
    filter.subject_id = req.query.subject_id;
  }
  if (req.query.academic_year) {
    filter.academic_year = req.query.academic_year;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [classSubjects, total] = await Promise.all([
    ClassSubject.find(filter)
      .populate('class_id', 'class_name grade section academic_year')
      .populate('subject_id', 'subject_name subject_code credits')
      .populate({
        path: 'teachers.teacher_id',
        populate: {
          path: 'user_id',
          select: 'personal_info'
        }
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ClassSubject.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    message: 'Class subjects retrieved successfully',
    data: {
      class_subjects: classSubjects,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit
      }
    }
  });
});

const getClassSubject = asyncHandler(async (req, res) => {
  const classSubject = await ClassSubject.findById(req.params.id)
    .populate('class_id', 'class_name grade section academic_year')
    .populate('subject_id', 'subject_name subject_code credits')
    .populate({
      path: 'teachers.teacher_id',
      populate: {
        path: 'user_id',
        select: 'personal_info email'
      }
    });

  if (!classSubject) {
    return res.status(404).json({
      success: false,
      message: 'Class subject not found',
      errors: ['No class subject found with this ID']
    });
  }

  res.status(200).json({
    success: true,
    message: 'Class subject retrieved successfully',
    data: { class_subject: classSubject }
  });
});

const createClassSubject = asyncHandler(async (req, res) => {
  const { class_id, subject_id, teachers, academic_year } = req.body;

  const [classDoc, subject] = await Promise.all([
    Class.findById(class_id),
    Subject.findById(subject_id)
  ]);

  if (!classDoc) {
    return res.status(404).json({
      success: false,
      message: 'Class not found',
      errors: ['Class does not exist']
    });
  }

  if (!subject) {
    return res.status(404).json({
      success: false,
      message: 'Subject not found',
      errors: ['Subject does not exist']
    });
  }

  const existingClassSubject = await ClassSubject.findOne({ 
    class_id, 
    subject_id, 
    academic_year: academic_year || classDoc.academic_year 
  });

  if (existingClassSubject) {
    return res.status(400).json({
      success: false,
      message: 'Class subject already exists',
      errors: ['This subject is already assigned to this class for this academic year']
    });
  }

  if (teachers && teachers.length > 0) {
    const teacherIds = teachers.map(t => t.teacher_id);
    const validTeachers = await Teacher.find({ _id: { $in: teacherIds } });
    if (validTeachers.length !== teacherIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid teachers',
        errors: ['One or more teachers do not exist']
      });
    }
  }

  const classSubject = await ClassSubject.create({
    class_id,
    subject_id,
    teachers: teachers || [],
    academic_year: academic_year || classDoc.academic_year
  });

  const populatedClassSubject = await ClassSubject.findById(classSubject._id)
    .populate('class_id', 'class_name grade section')
    .populate('subject_id', 'subject_name subject_code')
    .populate('teachers.teacher_id', 'teacher_code');

  res.status(201).json({
    success: true,
    message: 'Class subject created successfully',
    data: { class_subject: populatedClassSubject }
  });
});

const updateClassSubject = asyncHandler(async (req, res) => {
  const { teachers, status } = req.body;

  const classSubject = await ClassSubject.findById(req.params.id);
  if (!classSubject) {
    return res.status(404).json({
      success: false,
      message: 'Class subject not found',
      errors: ['No class subject found with this ID']
    });
  }

  if (teachers) {
    const teacherIds = teachers.map(t => t.teacher_id);
    const validTeachers = await Teacher.find({ _id: { $in: teacherIds } });
    if (validTeachers.length !== teacherIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid teachers',
        errors: ['One or more teachers do not exist']
      });
    }
    classSubject.teachers = teachers;
  }
  if (status) classSubject.status = status;

  await classSubject.save();

  const updatedClassSubject = await ClassSubject.findById(classSubject._id)
    .populate('class_id', 'class_name grade section')
    .populate('subject_id', 'subject_name subject_code')
    .populate('teachers.teacher_id', 'teacher_code');

  res.status(200).json({
    success: true,
    message: 'Class subject updated successfully',
    data: { class_subject: updatedClassSubject }
  });
});

const deleteClassSubject = asyncHandler(async (req, res) => {
  const classSubject = await ClassSubject.findById(req.params.id);
  
  if (!classSubject) {
    return res.status(404).json({
      success: false,
      message: 'Class subject not found',
      errors: ['No class subject found with this ID']
    });
  }

  await ClassSubject.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Class subject deleted successfully',
    data: null
  });
});

module.exports = {
  getClassSubjects,
  getClassSubject,
  createClassSubject,
  updateClassSubject,
  deleteClassSubject
};
