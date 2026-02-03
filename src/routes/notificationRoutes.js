const express = require('express');
const router = express.Router();
const {
    getMyNotifications,
    sendNotification,
    markAsRead,
    deleteNotification
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getMyNotifications);
router.post('/send', authorize('super_admin', 'admin'), sendNotification);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
