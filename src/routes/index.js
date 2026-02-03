const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const studentRoutes = require('./studentRoutes');
const teacherRoutes = require('./teacherRoutes');
const classRoutes = require('./classRoutes');
const subjectRoutes = require('./subjectRoutes');
const classSubjectRoutes = require('./classSubjectRoutes');
const feeRoutes = require('./feeRoutes');
const absenceRoutes = require('./absenceRoutes');
const userRoutes = require('./userRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const scheduleRoutes = require('./scheduleRoutes');
const notificationRoutes = require('./notificationRoutes');
const chatRoutes = require('./chat');
const courseRoutes = require('./courses');
const examRoutes = require('./exams');
const materialRoutes = require('./materials');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/students', studentRoutes);
router.use('/teachers', teacherRoutes);
router.use('/classes', classRoutes);
router.use('/subjects', subjectRoutes);
router.use('/class-subjects', classSubjectRoutes);
router.use('/fees', feeRoutes);
router.use('/absences', absenceRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chat', chatRoutes);
router.use('/courses', courseRoutes);
router.use('/exams', examRoutes);
router.use('/materials', materialRoutes);

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});



module.exports = router;
