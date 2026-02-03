const { Schedule, Class, Subject, Teacher, User, Student } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { getIO } = require('../socket');

// @desc    Get schedules with filters
// @route   GET /api/schedules
// @access  Protected
const getSchedules = asyncHandler(async (req, res) => {
    const { class_id, day, teacher_id } = req.query;
    const filter = {};

    if (class_id) filter.class_id = class_id;
    if (day) filter.day = day;
    if (teacher_id) filter.teacher_id = teacher_id;

    const schedules = await Schedule.find(filter)
        .populate('subject_id', 'name code')
        .populate({
            path: 'teacher_id',
            populate: { path: 'user_id', select: 'personal_info.first_name personal_info.last_name' }
        })
        .populate('class_id', 'class_name grade section');

    res.status(200).json({
        success: true,
        count: schedules.length,
        data: schedules
    });
});

// @desc    Get logged-in student's schedule
// @route   GET /api/schedules/my-schedule
// @access  Protected (Student)
const getMySchedule = asyncHandler(async (req, res) => {
    const student = await Student.findOne({ user_id: req.user._id });

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Student profile not found'
        });
    }

    if (!student.class_id) {
        return res.status(400).json({
            success: false,
            message: 'Student is not assigned to any class'
        });
    }

    const schedules = await Schedule.find({ class_id: student.class_id })
        .populate('subject_id', 'name code')
        .populate({
            path: 'teacher_id',
            populate: { path: 'user_id', select: 'personal_info.first_name personal_info.last_name' }
        })
        .populate('class_id', 'class_name grade section');

    res.status(200).json({
        success: true,
        count: schedules.length,
        data: schedules
    });
});

// @desc    Create a schedule entry
// @route   POST /api/schedules
// @access  Protected (Admin/Supervisor)
const createScheduleEntry = asyncHandler(async (req, res) => {
    const schedule = await Schedule.create(req.body);

    // Emit socket event to the class room
    const io = getIO();
    if (io) {
        io.to(`class_${schedule.class_id.toString()}`).emit('schedule_update', {
            type: 'create',
            scheduleId: schedule._id
        });
    }

    // Update last_schedule_update in Class model
    await Class.findByIdAndUpdate(schedule.class_id, { last_schedule_update: Date.now() });

    res.status(201).json({
        success: true,
        data: schedule
    });
});

// @desc    Update a schedule entry
// @route   PUT /api/schedules/:id
// @access  Protected (Admin/Supervisor)
const updateScheduleEntry = asyncHandler(async (req, res) => {
    let schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
        return res.status(404).json({
            success: false,
            message: 'Schedule entry not found'
        });
    }

    schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    // Emit socket event to the class room
    const io = getIO();
    if (io) {
        io.to(`class_${schedule.class_id.toString()}`).emit('schedule_update', {
            type: 'update',
            scheduleId: schedule._id
        });
    }

    // Update last_schedule_update in Class model
    await Class.findByIdAndUpdate(schedule.class_id, { last_schedule_update: Date.now() });

    res.status(200).json({
        success: true,
        data: schedule
    });
});

// @desc    Delete a schedule entry
// @route   DELETE /api/schedules/:id
// @access  Protected (Admin/Supervisor)
const deleteScheduleEntry = asyncHandler(async (req, res) => {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
        return res.status(404).json({
            success: false,
            message: 'Schedule entry not found'
        });
    }

    const classId = schedule.class_id;
    await schedule.deleteOne();

    // Emit socket event to the class room
    const io = getIO();
    if (io) {
        io.to(`class_${classId.toString()}`).emit('schedule_update', {
            type: 'delete',
            scheduleId: req.params.id
        });
    }

    // Update last_schedule_update in Class model
    await Class.findByIdAndUpdate(classId, { last_schedule_update: Date.now() });

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Mark schedule as viewed
// @route   POST /api/schedules/mark-viewed
// @access  Protected
const markScheduleViewed = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { last_schedule_viewed: Date.now() });

    res.status(200).json({
        success: true,
        data: {}
    });
});

module.exports = {
    getSchedules,
    createScheduleEntry,
    updateScheduleEntry,
    deleteScheduleEntry,
    markScheduleViewed,
    getMySchedule
};
