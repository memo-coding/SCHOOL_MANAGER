const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Exam = require('../models/Exam');
const Course = require('../models/Course');
const { ROLES } = require('../config/constants');
const { getIO } = require('../socket');

// @desc    Create a new exam
// @route   POST /api/exams
// @access  Teacher
const createExam = asyncHandler(async (req, res) => {
    const { title, course_id, class_id, subject_id, questions, duration, passingScore, type, linked_material_id, grade } = req.body;

    // Verify course ownership if course_id is provided
    if (course_id) {
        const course = await Course.findById(course_id);
        if (!course) {
            throw new AppError('Course not found', 404);
        }
    }

    try {
        console.log('[DEBUG-EXAM] Creating with data:', JSON.stringify(req.body, null, 2));

        // If grade is not provided but class_id is, try to inherit grade from Class
        let finalGrade = grade;
        if (!finalGrade && class_id && class_id !== "none") {
            const ClassModel = require('../models/Class');
            const classDoc = await ClassModel.findById(class_id);
            if (classDoc) finalGrade = classDoc.grade;
        }

        const exam = await Exam.create({
            title,
            course_id: (course_id && course_id !== "none") ? course_id : null,
            class_id: (class_id && class_id !== "none") ? class_id : null,
            subject_id: (subject_id && subject_id !== "none") ? subject_id : null,
            questions,
            duration,
            passingScore,
            type,
            linked_material_id,
            grade: finalGrade,
            createdBy: req.user._id
        });

        // Emit socket notification
        const io = getIO();
        if (io) {
            if (exam.class_id) {
                io.to(`class_${exam.class_id.toString()}`).emit('new_exam', exam);
            } else if (exam.grade) {
                io.to(`grade_${exam.grade}`).emit('new_exam', exam);
            }
        }

        res.status(201).json({
            success: true,
            data: exam
        });
    } catch (err) {
        console.error('[DEBUG-EXAM] Creation failed:', err.message);
        if (err.name === 'ValidationError') {
            Object.keys(err.errors).forEach(key => {
                console.error(`[DEBUG-EXAM] Validation Error on ${key}:`, err.errors[key].message);
            });
        }
        throw err;
    }
});

// @desc    Get exams for a course
// @route   GET /api/exams/course/:courseId
// @access  Private
const getExamsByCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // OPTIMIZED: Added lean() for faster query
    let query = Exam.find({ course_id: courseId })
        .populate('class_id', 'class_name grade')
        .populate('subject_id', 'subject_name subject_code');

    // Hide answers from list for students
    if (req.user.role === 'student') {
        query = query.select('-questions.correctOption');
    }

    const exams = await query.lean();

    // OPTIMIZED: Only fetch results if needed
    if (req.user.role === ROLES.STUDENT || req.user.role === ROLES.ADMIN) {
        try {
            const ExamResult = require('../models/ExamResult');
            const results = await ExamResult.find({ student_id: req.user._id })
                .select('exam_id')
                .lean();
            const completedExamIds = new Set(results.map(r => r.exam_id.toString()));

            exams.forEach(exam => {
                exam.isCompleted = completedExamIds.has(exam._id.toString());
            });
        } catch (err) {
            console.error('[DEBUG-EXAM] Error checking completion status:', err);
        }
    }

    res.status(200).json({
        success: true,
        data: exams
    });
});

// @desc    Get independent exams (not linked to a course)
// @route   GET /api/exams/independent
// @access  Private
const getIndependentExams = asyncHandler(async (req, res) => {
    let filter = { $or: [{ course_id: null }, { course_id: { $exists: false } }] };

    if (req.user.role === ROLES.STUDENT) {
        // OPTIMIZED: Added lean() and select only needed fields
        const student = await require('../models/Student').findOne({ user_id: req.user._id })
            .populate('class_id', 'grade')
            .lean();
        if (!student || !student.class_id) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        filter = {
            ...filter,
            $or: [
                { class_id: student.class_id._id },
                { grade: student.class_id.grade }
            ]
        };
    }

    let query = Exam.find(filter).populate('class_id', 'class_name grade').populate('subject_id', 'subject_name subject_code');

    if (req.user.role === ROLES.STUDENT) {
        query = query.select('-questions.correctOption');
    }

    const exams = await query.lean();

    // Add completion status for students
    if (req.user.role === ROLES.STUDENT || req.user.role === ROLES.ADMIN) {
        try {
            const ExamResult = require('../models/ExamResult');
            const results = await ExamResult.find({ student_id: req.user._id });
            const completedExamIds = new Set(results.map(r => r.exam_id.toString()));

            exams.forEach(exam => {
                exam.isCompleted = completedExamIds.has(exam._id.toString());
            });
        } catch (err) {
            console.error('[DEBUG-EXAM] Error checking completion status:', err);
        }
    }

    res.status(200).json({
        success: true,
        data: exams
    });
});

// @desc    Get single exam (for taking it)
// @route   GET /api/exams/:id
// @access  Private
const getExam = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id).populate('class_id');
    if (!exam) throw new AppError('Exam not found', 404);

    // If student, check if they have access to this exam's grade/class
    if (req.user.role === 'student') {
        const student = await require('../models/Student').findOne({ user_id: req.user._id }).populate('class_id');
        if (!student || !student.class_id) throw new AppError('Student profile not found', 404);

        const hasClassAccess = exam.class_id && exam.class_id._id.toString() === student.class_id._id.toString();
        const hasGradeAccess = exam.grade && exam.grade === student.class_id.grade;

        if (!hasClassAccess && !hasGradeAccess) {
            throw new AppError('You do not have access to this exam', 403);
        }

        // CHECK IF ALREADY TAKEN
        const ExamResult = require('../models/ExamResult');
        const existingResult = await ExamResult.findOne({ student_id: req.user._id, exam_id: req.params.id });
        if (existingResult) {
            throw new AppError('You have already taken this exam', 400);
        }

        const examObj = exam.toObject();
        examObj.questions.forEach(q => {
            delete q.correctOption;
        });
        return res.status(200).json({ success: true, data: examObj });
    }

    res.status(200).json({
        success: true,
        data: exam
    });
});

// @desc    Submit exam answers and get graded
// @route   POST /api/exams/:id/submit
// @access  Student
const submitExam = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { answers } = req.body; // Array of { question_id, selectedOption }

    const exam = await Exam.findById(id);
    if (!exam) throw new AppError('Exam not found', 404);

    const studentId = req.user._id;

    // Check if already taken
    const existingResult = await require('../models/ExamResult').findOne({ student_id: studentId, exam_id: id });
    if (existingResult) {
        throw new AppError('You have already taken this exam', 400);
    }

    let score = 0;
    let totalPoints = 0;
    const gradedAnswers = [];

    // Grading Logic
    exam.questions.forEach((q, idx) => {
        const qTotal = q.points || 1;
        totalPoints += qTotal;

        // Find student answer (assuming answers array matches index or has ID, but schema has _id for subdocs)
        // Let's assume frontend sends answers in order or with Question ID.
        // For robustness, let's assume answers is array of { questionId: string, selectedOption: number }
        // MATCHING:
        const studentAns = answers.find(a => a.questionId === q._id.toString());

        let isCorrect = false;
        if (studentAns) {
            if (studentAns.selectedOption === q.correctOption) {
                score += qTotal;
                isCorrect = true;
            }
        }

        gradedAnswers.push({
            question_id: q._id,
            selectedOption: studentAns ? studentAns.selectedOption : -1,
            isCorrect
        });
    });

    const percentage = (score / totalPoints) * 100;
    const status = percentage >= exam.passingScore ? 'passed' : 'failed';

    const result = await require('../models/ExamResult').create({
        student_id: studentId,
        exam_id: id,
        score,
        totalPoints,
        answers: gradedAnswers,
        status,
        gradedAt: Date.now()
    });

    // Notify Parent via WhatsApp (Mock)
    // In a real app, we'd look up student -> parent -> phone number
    try {
        console.log(`[WHATSAPP MOCK] Sent results to parent of ${req.user.username}: Scored ${score}/${totalPoints} (${status})`);
    } catch (err) {
        console.error('WhatsApp notification failed:', err);
    }

    res.status(200).json({
        success: true,
        data: result
    });
});

// @desc    Update exam
// @route   PUT /api/exams/:id
// @access  Teacher/Admin
const updateExam = asyncHandler(async (req, res) => {
    let exam = await Exam.findById(req.params.id);
    if (!exam) throw new AppError('Exam not found', 404);

    // Verify ownership
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' &&
        (!exam.createdBy || exam.createdBy.toString() !== req.user._id.toString())) {
        throw new AppError('Not authorized to update this exam', 403);
    }

    // Pick only allowed fields to avoid validation errors on read-only fields
    const { title, course_id, class_id, subject_id, questions, duration, passingScore, type, linked_material_id, grade } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;

    // Robust ID handling - Ensure we don't save empty strings or "none" as valid ObjectIds
    if (course_id !== undefined) {
        let val = (course_id && typeof course_id === 'object') ? course_id._id : course_id;
        updateData.course_id = (val === "" || val === "none") ? null : val;
    }
    if (class_id !== undefined) {
        let val = (class_id && typeof class_id === 'object') ? class_id._id : class_id;
        updateData.class_id = (val === "" || val === "none") ? null : val;
    }
    if (subject_id !== undefined) {
        let val = (subject_id && typeof subject_id === 'object') ? subject_id._id : subject_id;
        updateData.subject_id = (val === "" || val === "none") ? null : val;
    }

    if (questions !== undefined) updateData.questions = questions;
    if (duration !== undefined) updateData.duration = duration;
    if (passingScore !== undefined) updateData.passingScore = passingScore;
    if (type !== undefined) updateData.type = type;
    if (linked_material_id !== undefined) updateData.linked_material_id = linked_material_id;
    if (grade !== undefined) updateData.grade = grade;

    try {
        console.log('[DEBUG-EXAM] Updating exam:', req.params.id, 'with data:', JSON.stringify(updateData, null, 2));
        exam = await Exam.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        // Emit socket notification
        const io = getIO();
        if (io) {
            if (exam.class_id) {
                io.to(`class_${exam.class_id.toString()}`).emit('new_exam', exam);
            } else if (exam.grade) {
                io.to(`grade_${exam.grade}`).emit('new_exam', exam);
            }
        }
    } catch (err) {
        console.error('[DEBUG-EXAM] Update failed:', err.message);
        if (err.name === 'ValidationError') {
            const validationErrors = Object.keys(err.errors).map(key => `${key}: ${err.errors[key].message}`);
            console.error('[DEBUG-EXAM] Validation Details:', validationErrors.join(', '));
            throw new AppError(`Validation failed: ${validationErrors.join('. ')}`, 400);
        }
        throw err;
    }

    res.status(200).json({
        success: true,
        data: exam
    });
});

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Teacher/Admin
const deleteExam = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw new AppError('Exam not found', 404);

    // Verify ownership
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' &&
        (!exam.createdBy || exam.createdBy.toString() !== req.user._id.toString())) {
        throw new AppError('Not authorized to delete this exam', 403);
    }

    await Exam.findByIdAndDelete(req.params.id);

    res.status(200).json({
        success: true,
        data: {}
    });
});

module.exports = {
    createExam,
    getExamsByCourse,
    getIndependentExams,
    getExam,
    submitExam,
    updateExam,
    deleteExam
};
