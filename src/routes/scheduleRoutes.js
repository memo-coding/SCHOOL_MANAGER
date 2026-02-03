const express = require('express');
const router = express.Router();
const {
    getSchedules,
    createScheduleEntry,
    updateScheduleEntry,
    deleteScheduleEntry,
    markScheduleViewed,
    getMySchedule
} = require('../controllers/scheduleController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { scheduleValidators } = require('../middleware/validators');

router.use(protect);

router.get('/my-schedule', getMySchedule);

router
    .route('/')
    .get(getSchedules)
    .post(authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), scheduleValidators.create, createScheduleEntry);

router
    .route('/:id')
    .put(authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), scheduleValidators.update, updateScheduleEntry)
    .delete(authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), deleteScheduleEntry);

router.post('/mark-viewed', markScheduleViewed);

module.exports = router;
