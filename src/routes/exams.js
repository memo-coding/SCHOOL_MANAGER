const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { createExam, getExamsByCourse, getIndependentExams, getExam, submitExam, updateExam, deleteExam } = require('../controllers/examController');

router.use(protect);

router.post('/', authorize(ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN), createExam);
router.get('/independent', getIndependentExams);
router.get('/course/:courseId', getExamsByCourse);
router.post('/:id/submit', authorize(ROLES.STUDENT), submitExam);
router.get('/:id', getExam);
router.put('/:id', authorize(ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN), updateExam);
router.delete('/:id', authorize(ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN), deleteExam);

module.exports = router;
