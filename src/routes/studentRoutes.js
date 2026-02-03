const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudent,
  getStudentDetails,
  createStudent,
  updateStudent,
  deleteStudent
} = require('../controllers/studentController');
const { protect, checkPermission } = require('../middleware/auth');
const { studentValidators, mongoIdValidator, paginationValidator } = require('../middleware/validators');

router.use(protect);

router.get('/', checkPermission('students', 'read'), paginationValidator, getStudents);
router.get('/:id', checkPermission('students', 'read'), mongoIdValidator, getStudent);
router.get('/:id/details', checkPermission('students', 'read'), mongoIdValidator, getStudentDetails);
router.post('/', checkPermission('students', 'create'), studentValidators.create, createStudent);
router.put('/:id', checkPermission('students', 'update'), studentValidators.update, updateStudent);
router.delete('/:id', checkPermission('students', 'delete'), mongoIdValidator, deleteStudent);

const studentSubjectRoutes = require('./studentSubjectRoutes');

router.use('/:studentId/subjects', studentSubjectRoutes);

module.exports = router;
