const Notification = require('../models/Notification');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get current user notifications
// @route   GET /api/notifications
// @access  Private
exports.getMyNotifications = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;

    // Fetch individual notifications for this user OR global notifications (recipient = null)
    // For global notifications, we need to check if the user is in the 'read_by' array
    const notifications = await Notification.find({
        $or: [
            { recipient: userId },
            { recipient: null }
        ]
    }).sort({ createdAt: -1 }).limit(50);

    // Transform notifications to include a 'read' boolean based on context
    const transformedNotifications = notifications.map(notif => {
        let isRead = false;
        if (notif.recipient) {
            isRead = notif.is_read;
        } else {
            isRead = notif.read_by.includes(userId);
        }

        return {
            _id: notif._id,
            titleEn: notif.titleEn,
            titleAr: notif.titleAr,
            messageEn: notif.messageEn,
            messageAr: notif.messageAr,
            type: notif.type,
            createdAt: notif.createdAt,
            is_read: isRead,
            is_global: !notif.recipient
        };
    });

    res.status(200).json({
        success: true,
        data: transformedNotifications
    });
});

// @desc    Send a notification
// @route   POST /api/notifications/send
// @access  Private (Admin/Super Admin/Supervisor)
exports.sendNotification = asyncHandler(async (req, res, next) => {
    const { recipient, titleEn, titleAr, messageEn, messageAr, type } = req.body;

    const notification = await Notification.create({
        recipient: recipient === 'all' ? null : recipient,
        sender: req.user.id,
        titleEn,
        titleAr,
        messageEn,
        messageAr,
        type: type || 'info'
    });

    res.status(201).json({
        success: true,
        data: notification
    });
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
exports.markAsRead = asyncHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.recipient) {
        // Individual notification
        if (notification.recipient.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        notification.is_read = true;
    } else {
        // Global notification
        if (!notification.read_by.includes(req.user.id)) {
            notification.read_by.push(req.user.id);
        }
    }

    await notification.save();

    res.status(200).json({
        success: true,
        message: 'Marked as read'
    });
});

// @desc    Delete a notification for the current user
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = asyncHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // If it's an individual notification, the recipient can delete it
    // If it's a global notification, we can't really "delete" it for one user and keep it for others easily 
    // unless we have an 'excluded_users' array. For now, let's just handle individual deletion or admin deletion.

    if (notification.recipient && notification.recipient.toString() !== req.user.id && !['super_admin', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Notification deleted'
    });
});
