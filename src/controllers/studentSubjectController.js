const { StudentSubject, Student, ClassSubject } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');

const getStudentSubjects = asyncHandler(async (req, res) => {
    const studentId = req.params.studentId;

    const studentSubjects = await StudentSubject.find({
        student_id: studentId,
        status: 'enrolled'
    })
        .populate({
            path: 'class_subject_id',
            populate: {
                path: 'subject_id',
                select: 'subject_name subject_code credits'
            }
        })
        .populate({
            path: 'class_subject_id',
            populate: {
                path: 'teachers.teacher_id',
                select: 'teacher_code'
            }
        });

    // Transform to match the structure the frontend expects (similar to getStudentDetails previously)
    const subjects = studentSubjects.map(ss => ({
        _id: ss.class_subject_id._id, // The ID the frontend uses to manage
        student_subject_id: ss._id,   // The actual enrollment ID
        subject_id: ss.class_subject_id.subject_id,
        teachers: ss.class_subject_id.teachers,
        status: ss.status,
        academic_year: ss.class_subject_id.academic_year
    }));

    res.status(200).json({
        success: true,
        message: 'Student subjects retrieved successfully',
        data: { subjects }
    });
});

const enrollStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    let { class_subject_id, subject_id } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Creating ClassSubject link on the fly if subject_id is provided
    if (subject_id && !class_subject_id) {
        // Check if class-subject link already exists
        let classSubject = await ClassSubject.findOne({
            class_id: student.class_id,
            subject_id: subject_id
        });

        if (!classSubject) {
            // Get class to find academic year
            const classDoc = await Student.findOne({ _id: studentId }).populate('class_id');
            const academicYear = classDoc.class_id.academic_year;

            // Create new ClassSubject
            classSubject = await ClassSubject.create({
                class_id: student.class_id,
                subject_id: subject_id,
                academic_year: academicYear,
                status: 'active'
            });
        }
        class_subject_id = classSubject._id;
    }

    if (!class_subject_id) {
        return res.status(400).json({ success: false, message: 'Either class_subject_id or subject_id is required' });
    }

    const classSubject = await ClassSubject.findById(class_subject_id);
    if (!classSubject) {
        return res.status(404).json({ success: false, message: 'Class Subject not found' });
    }

    // Ensure student is in the same class as the subject
    if (student.class_id.toString() !== classSubject.class_id.toString()) {
        return res.status(400).json({
            success: false,
            message: 'Student is not in the class for this subject'
        });
    }

    const existingEnrollment = await StudentSubject.findOne({
        student_id: studentId,
        class_subject_id
    });

    if (existingEnrollment) {
        if (existingEnrollment.status !== 'enrolled') {
            existingEnrollment.status = 'enrolled';
            await existingEnrollment.save();
            return res.status(200).json({ success: true, message: 'Re-enrolled student', data: existingEnrollment });
        }
        return res.status(400).json({ success: false, message: 'Student already enrolled' });
    }

    const enrollment = await StudentSubject.create({
        student_id: studentId,
        class_subject_id
    });

    res.status(201).json({
        success: true,
        message: 'Student enrolled successfully',
        data: enrollment
    });
});

const unenrollStudent = asyncHandler(async (req, res) => {
    const { studentId, classSubjectId } = req.params;

    // We find by student_id + class_subject_id to be safe
    const enrollment = await StudentSubject.findOneAndDelete({
        student_id: studentId,
        class_subject_id: classSubjectId
    });

    if (!enrollment) {
        return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    res.status(200).json({
        success: true,
        message: 'Student unenrolled successfully'
    });
});

module.exports = {
    getStudentSubjects,
    enrollStudent,
    unenrollStudent
};
