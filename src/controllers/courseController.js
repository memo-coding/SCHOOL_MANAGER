const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Course = require('../models/Course');
const ClassSubject = require('../models/ClassSubject');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { ROLES } = require('../config/constants');
const { getIO } = require('../socket');

// @desc    Create a new course
// @route   POST /api/courses
// @access  Teacher
const createCourse = asyncHandler(async (req, res) => {
    const { class_subject_id, title, description } = req.body;
    console.log('[DEBUG-COURSE] Creating Course. User:', req.user?._id, 'Role:', req.user?.role);
    console.log('[DEBUG-COURSE] Class Subject ID:', class_subject_id);
    let teacherIdToAssign;

    if (req.user.role === ROLES.TEACHER) {
        // Verify ownership
        const teacherRecord = await Teacher.findOne({ user_id: req.user._id });
        if (!teacherRecord) {
            throw new AppError('Teacher profile not found', 404);
        }

        // Check if teacher is assigned to this ClassSubject
        const classSubject = await ClassSubject.findOne({
            _id: class_subject_id,
            'teachers.teacher_id': teacherRecord._id
        });

        if (!classSubject) {
            throw new AppError('You are not authorized to create courses for this subject', 403);
        }
        teacherIdToAssign = teacherRecord._id;
    } else if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN) {
        // Admin Logic: Assign to the primary teacher of the subject
        const classSubject = await ClassSubject.findById(class_subject_id);
        if (!classSubject) throw new AppError('Class Subject not found', 404);

        if (classSubject.teachers && classSubject.teachers.length > 0) {
            // Try to find is_primary, else first
            const primaryTeacher = classSubject.teachers.find(t => t.is_primary);
            teacherIdToAssign = primaryTeacher ? primaryTeacher.teacher_id : classSubject.teachers[0].teacher_id;
        } else {
            // No teacher assigned, allowed since teacher_id is now optional for Courses created by Admin
            teacherIdToAssign = null;
        }
    } else {
        throw new AppError('Unauthorized', 403);
    }

    const course = await Course.create({
        class_subject_id,
        title,
        description,
        teacher_id: teacherIdToAssign
    });

    // Notify class room
    const io = getIO();
    if (io) {
        const classSubject = await ClassSubject.findById(class_subject_id);
        if (classSubject && classSubject.class_id) {
            io.to(`class_${classSubject.class_id.toString()}`).emit('new_course', {
                title: course.title,
                courseId: course._id
            });
        }
    }

    res.status(201).json({
        success: true,
        data: course
    });
});

// @desc    Get courses (Teacher: their created courses, Student: their class courses)
// @route   GET /api/courses
// @access  Private
const getCourses = asyncHandler(async (req, res) => {
    const { role, _id } = req.user;
    let query = {};

    if (role === ROLES.TEACHER) {
        const teacherRecord = await Teacher.findOne({ user_id: _id });
        if (!teacherRecord) throw new AppError('Teacher not found', 404);
        query = { teacher_id: teacherRecord._id };
    } else if (role === ROLES.STUDENT) {
        const studentRecord = await Student.findOne({ user_id: _id });
        if (!studentRecord) {
            // Return empty array if student profile not found
            console.log('[DEBUG-COURSE] Student profile not found for user:', _id);
            return res.status(200).json({ success: true, data: [] });
        }

        // Find ClassSubjects for student's class
        const classSubjects = await ClassSubject.find({ class_id: studentRecord.class_id });
        const classSubjectIds = classSubjects.map(cs => cs._id);

        query = { class_subject_id: { $in: classSubjectIds }, is_active: true };
    } else if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) {
        // Admin sees all
    } else {
        throw new AppError('Unauthorized', 403);
    }

    const courses = await Course.find(query)
        .populate({
            path: 'class_subject_id',
            populate: [
                { path: 'subject_id', select: 'subject_name' },
                { path: 'class_id', select: 'class_name grade section' }
            ]
        })
        .sort('-createdAt');

    res.status(200).json({
        success: true,
        data: courses
    });
});

// @desc    Add material to course
// @route   POST /api/courses/:id/materials
// @access  Teacher
const addMaterial = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, type, url, description } = req.body;

    // File handled by middleware, path in req.file
    let filePath = req.file ? `/uploads/materials/${req.file.filename}` : null;
    let finalUrl = url;

    // Use file path as URL if uploaded
    if (type !== 'link' && filePath) {
        finalUrl = filePath;
    }

    const course = await Course.findById(id);
    if (!course) throw new AppError('Course not found', 404);

    // Verify ownership
    if (req.user.role === ROLES.TEACHER) {
        const teacherRecord = await Teacher.findOne({ user_id: req.user._id });
        if (!teacherRecord || course.teacher_id.toString() !== teacherRecord._id.toString()) {
            throw new AppError('Unauthorized', 403);
        }
    } else if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN) {
        // Admin allowed to add material to any course
    } else {
        throw new AppError('Unauthorized', 403);
    }

    course.materials.push({
        title,
        type,
        url: finalUrl,
        file_path: filePath,
        description
    });

    await course.save();

    // Notify class room
    const io = getIO();
    if (io) {
        const classSubject = await ClassSubject.findById(course.class_subject_id);
        if (classSubject && classSubject.class_id) {
            io.to(`class_${classSubject.class_id.toString()}`).emit('new_material', {
                title: title,
                courseId: course._id
            });
        }
    }

    res.status(200).json({
        success: true,
        data: course
    });
});

module.exports = {
    createCourse,
    getCourses,
    addMaterial
};
