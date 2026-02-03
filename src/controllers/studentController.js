const mongoose = require('mongoose');
const { User, Student, Class, Absence, Fee, ClassSubject, StudentSubject, Setting } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { PAGINATION, ROLES } = require('../config/constants');

const getStudents = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const mongoFilter = {};

  if (req.query.class_id) {
    mongoFilter.class_id = new mongoose.Types.ObjectId(req.query.class_id);
  }
  if (req.query.academic_status) {
    mongoFilter.academic_status = req.query.academic_status;
  }
  if (req.query.fee_status) {
    mongoFilter.fee_status = req.query.fee_status;
  }

  if (req.user.role === ROLES.STUDENT) {
    mongoFilter.user_id = new mongoose.Types.ObjectId(req.user._id);
  }

  // Optimized Search Logic: Search User collection first for performance
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    const matchingUsers = await User.find({
      $or: [
        { email: searchRegex },
        { 'personal_info.first_name': searchRegex },
        { 'personal_info.last_name': searchRegex }
      ]
    }).select('_id').lean();

    const userIds = matchingUsers.map(u => u._id);

    mongoFilter.$or = [
      { student_code: searchRegex },
      { user_id: { $in: userIds } }
    ];
  }

  const pipeline = [
    { $match: mongoFilter },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    // Join with users
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'user_id'
      }
    },
    { $unwind: '$user_id' },
    // Join with classes
    {
      $lookup: {
        from: 'classes',
        localField: 'class_id',
        foreignField: '_id',
        as: 'class_id'
      }
    },
    { $unwind: { path: '$class_id', preserveNullAndEmptyArrays: true } },
    // Join with absences to count approved ones
    {
      $lookup: {
        from: 'absences',
        let: { studentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$student_id', '$$studentId'] },
                  { $eq: ['$status', 'approved'] }
                ]
              }
            }
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }
            }
          },
          { $count: 'count' }
        ],
        as: 'absence_count'
      }
    },
    {
      $addFields: {
        total_absences: {
          $ifNull: [{ $arrayElemAt: ['$absence_count.count', 0] }, 0]
        }
      }
    },
    // Project user_id fields
    {
      $project: {
        absence_count: 0,
        'user_id.password': 0,
        'user_id.otp': 0,
        'user_id.otp_expires': 0,
        'user_id.refresh_token': 0
      }
    }
  ];

  // Fetch data, total for pagination
  const promises = [
    Student.aggregate(pipeline),
    Student.countDocuments(mongoFilter)
  ];

  // Only calculate global stats if explicitly requested to save resources (optimization phase 2)
  if (req.query.include_stats === 'true') {
    promises.push(Student.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$academic_status', 'active'] }, 1, 0] }
          },
          graduated: {
            $sum: { $cond: [{ $eq: ['$academic_status', 'graduated'] }, 1, 0] }
          },
          suspended: {
            $sum: { $cond: [{ $eq: ['$academic_status', 'suspended'] }, 1, 0] }
          }
        }
      }
    ]));
  }

  const results = await Promise.all(promises);
  const students = results[0];
  const total = results[1];
  const globalStats = req.query.include_stats === 'true' ? results[2] : [];

  const stats = globalStats[0] || (req.query.include_stats === 'true' ? { total: 0, active: 0, graduated: 0, suspended: 0 } : null);

  console.log(`[DEBUG] getStudents: Found ${students.length} students out of ${total} total`);

  // Calculate days present in backend to improve performance
  const weekendDaysSetting = await Setting.findOne({ key: 'weekend_days' });
  const weekendDays = weekendDaysSetting ? weekendDaysSetting.value : [0, 6];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const processedStudents = students.map(student => {
    const startDate = new Date(student.enrollment_date || student.createdAt);
    startDate.setHours(0, 0, 0, 0);

    const timeDiff = today.getTime() - startDate.getTime();
    if (timeDiff < 0) {
      return { ...student, days_present: 0 };
    }

    const totalDays = Math.floor(timeDiff / (24 * 3600 * 1000)) + 1;
    const fullWeeks = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;

    // Math-based calculation (Optimization Phase 2)
    let weekdaysCount = fullWeeks * (7 - weekendDays.length);

    // Check remaining days at the end of the range
    let tempDate = new Date(startDate);
    tempDate.setDate(tempDate.getDate() + (fullWeeks * 7));
    for (let i = 0; i < remainingDays; i++) {
      if (!weekendDays.includes(tempDate.getDay())) {
        weekdaysCount++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    return {
      ...student,
      days_present: Math.max(0, weekdaysCount - (student.total_absences || 0))
    };
  });

  res.status(200).json({
    success: true,
    message: 'Students retrieved successfully',
    data: {
      students: processedStudents,
      stats,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit
      }
    }
  });
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate('user_id', 'username email personal_info is_active')
    .populate('class_id', 'class_name grade section academic_year');

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
      errors: ['No student found with this ID']
    });
  }

  res.status(200).json({
    success: true,
    message: 'Student retrieved successfully',
    data: { student }
  });
});

const getStudentDetails = asyncHandler(async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.id);

  const student = await Student.findById(studentId)
    .populate('user_id', 'username email personal_info is_active')
    .populate('class_id', 'class_name grade section academic_year');

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
      errors: ['No student found with this ID']
    });
  }

  const classId = student.class_id?._id || student.class_id;

  const [studentSubjects, classSubjects] = await Promise.all([
    StudentSubject.find({ student_id: studentId, status: 'enrolled' })
      .populate({
        path: 'class_subject_id',
        populate: [
          {
            path: 'subject_id',
            select: 'subject_name subject_code credits'
          },
          {
            path: 'class_id',
            select: 'class_name grade section'
          },
          {
            path: 'teachers.teacher_id',
            select: 'teacher_code'
          }
        ]
      }),
    ClassSubject.find({ class_id: classId, status: 'active' })
      .populate('subject_id', 'subject_name subject_code credits')
      .populate('class_id', 'class_name grade section')
      .populate('teachers.teacher_id', 'teacher_code')
  ]);

  console.log(`[DEBUG] getStudentDetails for student ${student.student_code}:`);
  console.log(`  - Student ID: ${studentId}`);
  console.log(`  - Class ID found: ${classId}`);
  console.log(`  - StudentSubjects count: ${studentSubjects.length}`);
  console.log(`  - ClassSubjects count: ${classSubjects.length}`);

  // Combine and deduplicate subjects
  const subjectMap = new Map();

  // 1. Add class subjects first (base list)
  classSubjects.forEach(cs => {
    if (cs.subject_id) {
      subjectMap.set(cs._id.toString(), {
        _id: cs._id,
        subject_id: cs.subject_id,
        class_id: cs.class_id,
        teachers: cs.teachers,
        source: 'class'
      });
    }
  });

  // 2. Add/Override with individual student subjects
  studentSubjects.forEach(ss => {
    if (ss.class_subject_id && ss.class_subject_id.subject_id) {
      subjectMap.set(ss.class_subject_id._id.toString(), {
        _id: ss.class_subject_id._id,
        subject_id: ss.class_subject_id.subject_id,
        class_id: ss.class_subject_id.class_id,
        teachers: ss.class_subject_id.teachers,
        status: ss.status,
        source: 'individual'
      });
    }
  });

  const subjects = Array.from(subjectMap.values());

  const absenceCount = await Absence.countDocuments({
    student_id: studentId,
    status: 'approved'
  });

  const absenceBySubject = await Absence.getAbsenceBySubject(studentId);

  const feeSummary = await Fee.getStudentFeesSummary(studentId);

  const recentFees = await Fee.find({ student_id: studentId })
    .sort({ due_date: -1 })
    .limit(5);

  res.status(200).json({
    success: true,
    message: 'Student details retrieved successfully',
    data: {
      student,
      subjects: subjects,
      attendance: {
        total_absences: absenceCount,
        by_subject: absenceBySubject
      },
      fees: {
        summary: feeSummary,
        recent: recentFees
      }
    }
  });
});

const createStudent = asyncHandler(async (req, res) => {
  const { user_id, class_id, student_code, parent_info, enrollment_date, subject_ids } = req.body;

  const user = await User.findById(user_id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: ['User does not exist']
    });
  }

  if (user.role !== ROLES.STUDENT) {
    user.role = ROLES.STUDENT;
    await user.save({ validateBeforeSave: false });
  }

  const classExists = await Class.findById(class_id);
  if (!classExists) {
    return res.status(404).json({
      success: false,
      message: 'Class not found',
      errors: ['Class does not exist']
    });
  }

  const existingStudent = await Student.findOne({ user_id });
  if (existingStudent) {
    return res.status(400).json({
      success: false,
      message: 'Student already exists',
      errors: ['This user is already registered as a student']
    });
  }

  const generatedCode = student_code || await Student.generateStudentCode();

  const student = await Student.create({
    user_id,
    class_id,
    student_code: generatedCode,
    parent_info,
    enrollment_date
  });

  // Handle initial subject enrollment
  if (Array.isArray(subject_ids) && subject_ids.length > 0) {
    const studentSubjects = subject_ids.map(classSubjectId => ({
      student_id: student._id,
      class_subject_id: classSubjectId,
      status: 'enrolled'
    }));
    await StudentSubject.insertMany(studentSubjects);
  }

  await classExists.updateStudentCount();

  const populatedStudent = await Student.findById(student._id)
    .populate('user_id', 'username email personal_info')
    .populate('class_id', 'class_name grade section');

  res.status(201).json({
    success: true,
    message: 'Student created successfully',
    data: { student: populatedStudent }
  });
});

const updateStudent = asyncHandler(async (req, res) => {
  const { class_id, parent_info, academic_status, fee_status } = req.body;

  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
      errors: ['No student found with this ID']
    });
  }

  const oldClassId = student.class_id;

  if (class_id) {
    const classExists = await Class.findById(class_id);
    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
        errors: ['Class does not exist']
      });
    }
    student.class_id = class_id;
  }

  if (parent_info) {
    student.parent_info = { ...student.parent_info, ...parent_info };
  }
  if (academic_status) {
    student.academic_status = academic_status;
  }
  if (fee_status) {
    student.fee_status = fee_status;
  }

  await student.save();

  if (class_id && class_id.toString() !== oldClassId.toString()) {
    const [oldClass, newClass] = await Promise.all([
      Class.findById(oldClassId),
      Class.findById(class_id)
    ]);
    if (oldClass) await oldClass.updateStudentCount();
    if (newClass) await newClass.updateStudentCount();
  }

  const updatedStudent = await Student.findById(student._id)
    .populate('user_id', 'username email personal_info')
    .populate('class_id', 'class_name grade section');

  res.status(200).json({
    success: true,
    message: 'Student updated successfully',
    data: { student: updatedStudent }
  });
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
      errors: ['No student found with this ID']
    });
  }

  const classId = student.class_id;

  await Student.findByIdAndDelete(req.params.id);

  const classDoc = await Class.findById(classId);
  if (classDoc) {
    await classDoc.updateStudentCount();
  }

  res.status(200).json({
    success: true,
    message: 'Student deleted successfully',
    data: null
  });
});

module.exports = {
  getStudents,
  getStudent,
  getStudentDetails,
  createStudent,
  updateStudent,
  deleteStudent
};
