const mongoose = require('mongoose');

const examResultSchema = new mongoose.Schema({
    student_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Linking to User (student)
        required: true
    },
    exam_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    totalPoints: {
        type: Number,
        required: true
    },
    answers: [{
        question_id: String, // Or just index
        selectedOption: Number,
        isCorrect: Boolean
    }],
    status: {
        type: String,
        enum: ['passed', 'failed'],
        required: true
    },
    gradedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Prevent multiple submissions for same exam by same student
examResultSchema.index({ student_id: 1, exam_id: 1 }, { unique: true });

module.exports = mongoose.model('ExamResult', examResultSchema);
