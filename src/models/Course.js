const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['video', 'file', 'link'],
        required: true
    },
    url: {
        type: String,
        required: true
    },
    file_path: {
        type: String // Local path if uploaded
    },
    description: {
        type: String,
        trim: true
    },
    uploaded_at: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const courseSchema = new mongoose.Schema({
    class_subject_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClassSubject',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    teacher_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: false
    },
    materials: [materialSchema],
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index for quick lookup by class/subject
courseSchema.index({ class_subject_id: 1 });
courseSchema.index({ teacher_id: 1 });

module.exports = mongoose.model('Course', courseSchema);
