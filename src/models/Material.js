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
        type: String
    },
    description: {
        type: String,
        trim: true
    },
    grade: {
        type: Number,
        required: [true, 'Grade is required'],
        min: 1,
        max: 12
    },
    class_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    subject_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
    },
    uploaded_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    allow_download: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Material', materialSchema);
