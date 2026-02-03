const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    options: [{
        type: String,
        required: true
    }],
    correctOption: {
        type: Number, // Index of the correct option
        required: true
    },
    points: {
        type: Number,
        default: 1
    }
});

const examSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    course_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: false
    },
    class_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    subject_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    questions: [questionSchema],
    duration: {
        type: Number, // in minutes
        required: true
    },
    passingScore: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['exam', 'homework'],
        default: 'exam'
    },
    linked_material_id: {
        type: String, // ID of the video in Course materials
        default: null
    },
    grade: {
        type: Number,
        min: 1,
        max: 12
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Exam', examSchema);
