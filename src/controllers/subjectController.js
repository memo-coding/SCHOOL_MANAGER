const { Subject, ClassSubject, Teacher, Student } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { PAGINATION } = require('../config/constants');

const getSubjects = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [subjects, total] = await Promise.all([
    Subject.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ subject_name: 1 }),
    Subject.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    message: 'Subjects retrieved successfully',
    data: {
      subjects,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit
      }
    }
  });
});

const getSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id);

  if (!subject) {
    return res.status(404).json({
      success: false,
      message: 'Subject not found',
      errors: ['No subject found with this ID']
    });
  }

  const classSubjects = await ClassSubject.find({
    subject_id: subject._id,
    status: 'active'
  })
    .populate('class_id', 'class_name grade section academic_year')
    .populate({
      path: 'teachers.teacher_id',
      populate: {
        path: 'user_id',
        select: 'personal_info'
      }
    });

  res.status(200).json({
    success: true,
    message: 'Subject retrieved successfully',
    data: {
      subject,
      classes: classSubjects
    }
  });
});

const createSubject = asyncHandler(async (req, res) => {
  const { subject_name, subject_code, description, credits, category } = req.body;

  const generatedCode = subject_code || await Subject.generateSubjectCode(subject_name);

  const existingSubject = await Subject.findOne({ subject_code: generatedCode.toUpperCase() });
  if (existingSubject) {
    return res.status(400).json({
      success: false,
      message: 'Subject code already exists',
      errors: ['A subject with this code already exists']
    });
  }

  const subject = await Subject.create({
    subject_name,
    subject_code: generatedCode,
    description,
    credits: credits || 1,
    category: category || 'core'
  });

  res.status(201).json({
    success: true,
    message: 'Subject created successfully',
    data: { subject }
  });
});

const updateSubject = asyncHandler(async (req, res) => {
  const { subject_code, subject_name, description, credits, category, status } = req.body;

  const subject = await Subject.findById(req.params.id);
  if (!subject) {
    return res.status(404).json({
      success: false,
      message: 'Subject not found',
      errors: ['No subject found with this ID']
    });
  }

  if (subject_name) subject.subject_name = subject_name;
  if (subject_code) subject.subject_code = subject_code;
  if (description !== undefined) subject.description = description;
  if (credits !== undefined) subject.credits = credits;
  if (category) subject.category = category;
  if (status) subject.status = status;

  await subject.save();

  res.status(200).json({
    success: true,
    message: 'Subject updated successfully',
    data: { subject }
  });
});

const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id);

  if (!subject) {
    return res.status(404).json({
      success: false,
      message: 'Subject not found',
      errors: ['No subject found with this ID']
    });
  }

  const activeClassSubjects = await ClassSubject.countDocuments({
    subject_id: subject._id,
    status: 'active'
  });

  if (activeClassSubjects > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete subject',
      errors: ['Subject is assigned to active classes. Remove assignments first.']
    });
  }

  await Teacher.updateMany(
    { subjects: subject._id },
    { $pull: { subjects: subject._id } }
  );

  await Subject.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Subject deleted successfully',
    data: null
  });
});

const getSubjectsWithStudents = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }

  // OPTIMIZED: Using aggregation to avoid N+1 query problem
  const pipeline = [
    { $match: filter },
    { $sort: { subject_name: 1 } },
    { $skip: skip },
    { $limit: limit },
    // Join with ClassSubject
    {
      $lookup: {
        from: 'classsubjects',
        let: { subjectId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$subject_id', '$$subjectId'] },
                  { $eq: ['$status', 'active'] }
                ]
              }
            }
          },
          {
            $lookup: {
              from: 'classes',
              localField: 'class_id',
              foreignField: '_id',
              as: 'class_info'
            }
          },
          { $unwind: '$class_info' }
        ],
        as: 'classSubjects'
      }
    },
    // Extract class IDs for student lookup
    {
      $addFields: {
        classIds: '$classSubjects.class_id'
      }
    },
    // Join with Students
    {
      $lookup: {
        from: 'students',
        let: { classIds: '$classIds' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$class_id', '$$classIds'] },
                  { $eq: ['$academic_status', 'active'] }
                ]
              }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user_info'
            }
          },
          { $unwind: '$user_info' },
          {
            $lookup: {
              from: 'classes',
              localField: 'class_id',
              foreignField: '_id',
              as: 'class_info'
            }
          },
          { $unwind: '$class_info' }
        ],
        as: 'students'
      }
    },
    {
      $project: {
        _id: 1,
        subject_name: 1,
        subject_code: 1,
        description: 1,
        credits: 1,
        category: 1,
        status: 1,
        total_students: { $size: '$students' },
        classes: {
          $map: {
            input: '$classSubjects',
            as: 'cs',
            in: {
              class_id: '$$cs.class_id',
              class_name: '$$cs.class_info.class_name',
              grade: '$$cs.class_info.grade',
              section: '$$cs.class_info.section'
            }
          }
        },
        students: {
          $map: {
            input: '$students',
            as: 's',
            in: {
              student_id: '$$s._id',
              student_code: '$$s.student_code',
              name: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$$s.user_info.personal_info.first_name', ''] },
                      ' ',
                      { $ifNull: ['$$s.user_info.personal_info.last_name', ''] }
                    ]
                  }
                }
              },
              email: '$$s.user_info.email',
              class: '$$s.class_info.class_name',
              grade: '$$s.class_info.grade',
              section: '$$s.class_info.section',
              academic_status: '$$s.academic_status',
              fee_status: '$$s.fee_status'
            }
          }
        }
      }
    }
  ];

  const [subjectsWithStudents, total] = await Promise.all([
    Subject.aggregate(pipeline),
    Subject.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    message: 'Subjects with students retrieved successfully',
    data: {
      subjects: subjectsWithStudents,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit
      }
    }
  });
});

module.exports = {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectsWithStudents
};
