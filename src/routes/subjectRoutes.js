const express = require('express');
const router = express.Router();
const {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectsWithStudents
} = require('../controllers/subjectController');
const { protect, checkPermission } = require('../middleware/auth');
const { subjectValidators, mongoIdValidator, paginationValidator } = require('../middleware/validators');

router.use(protect);

router.get('/', checkPermission('subjects', 'read'), paginationValidator, getSubjects);
router.get('/with-students', checkPermission('subjects', 'read'), paginationValidator, getSubjectsWithStudents);
router.get('/:id', checkPermission('subjects', 'read'), mongoIdValidator, getSubject);
router.post('/', checkPermission('subjects', 'create'), subjectValidators.create, createSubject);
router.put('/:id', checkPermission('subjects', 'update'), subjectValidators.update, updateSubject);
router.delete('/:id', checkPermission('subjects', 'delete'), mongoIdValidator, deleteSubject);

module.exports = router;
