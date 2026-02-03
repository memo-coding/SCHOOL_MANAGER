const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    class_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: [true, 'Class is required']
    },
    subject_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: [true, 'Subject is required']
    },
    teacher_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: [true, 'Teacher is required']
    },
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: [true, 'Day is required']
    },
    start_time: {
        type: String, // HH:MM format
        required: [true, 'Start time is required']
    },
    end_time: {
        type: String, // HH:MM format
        required: [true, 'End time is required']
    },
    room: {
        type: String,
        trim: true
    },
    academic_year: {
        type: String,
        required: [true, 'Academic year is required']
    }
}, {
    timestamps: true
});

// Index for efficient querying
scheduleSchema.index({ class_id: 1, day: 1, start_time: 1 });
scheduleSchema.index({ teacher_id: 1, day: 1, start_time: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
