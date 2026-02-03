const express = require('express');
const router = express.Router();
const {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher
} = require('../controllers/teacherController');
const { protect, checkPermission } = require('../middleware/auth');
const { teacherValidators, mongoIdValidator, paginationValidator } = require('../middleware/validators');

router.use(protect);

router.get('/', checkPermission('teachers', 'read'), paginationValidator, getTeachers);
router.get('/:id', checkPermission('teachers', 'read'), mongoIdValidator, getTeacher);
router.post('/', checkPermission('teachers', 'create'), teacherValidators.create, createTeacher);
router.put('/:id', checkPermission('teachers', 'update'), teacherValidators.update, updateTeacher);
router.delete('/:id', checkPermission('teachers', 'delete'), mongoIdValidator, deleteTeacher);

module.exports = router;
