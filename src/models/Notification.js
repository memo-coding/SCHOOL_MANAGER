const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null means sent to everyone (global notification)
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    titleEn: {
        type: String,
        required: true,
        trim: true
    },
    titleAr: {
        type: String,
        required: true,
        trim: true
    },
    messageEn: {
        type: String,
        required: true
    },
    messageAr: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info'
    },
    is_read: {
        type: Boolean,
        default: false
    },
    read_by: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

notificationSchema.index({ recipient: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
