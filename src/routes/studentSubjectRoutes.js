const express = require('express');
const router = express.Router({ mergeParams: true }); // Enable access to :id from parent router if nested
const { protect, checkPermission } = require('../middleware/auth');
const {
    getStudentSubjects,
    enrollStudent,
    unenrollStudent
} = require('../controllers/studentSubjectController');

router.use(protect);

router.get('/', checkPermission('students', 'read'), getStudentSubjects);
router.post('/', checkPermission('students', 'update'), enrollStudent);
router.delete('/:classSubjectId', checkPermission('students', 'update'), unenrollStudent);

module.exports = router;
