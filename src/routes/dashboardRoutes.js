const express = require('express');
const router = express.Router();
const { getDashboardStats, getAttendanceStats, getSystemActivities } = require('../controllers/dashboardController');
const { getSetting, updateSetting } = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/stats', protect, getDashboardStats);
router.get('/attendance-stats', protect, getAttendanceStats);
router.get('/activities', protect, getSystemActivities);
router.get('/settings/:key', protect, getSetting);
router.post('/settings', protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), updateSetting);

module.exports = router;
