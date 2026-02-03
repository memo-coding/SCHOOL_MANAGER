const mongoose = require('mongoose');

const studentSubjectSchema = new mongoose.Schema({
    student_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'Student ID is required']
    },
    class_subject_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClassSubject',
        required: [true, 'Class Subject ID is required']
    },
    status: {
        type: String,
        enum: ['enrolled', 'dropped', 'completed', 'failed'],
        default: 'enrolled'
    },
    enrollment_date: {
        type: Date,
        default: Date.now
    },
    final_grade: {
        type: Number,
        min: 0,
        max: 100
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Prevent duplicate enrollment for the same class subject
studentSubjectSchema.index({ student_id: 1, class_subject_id: 1 }, { unique: true });

// Useful indexes
studentSubjectSchema.index({ student_id: 1, status: 1 });
studentSubjectSchema.index({ class_subject_id: 1 });

module.exports = mongoose.model('StudentSubject', studentSubjectSchema);
