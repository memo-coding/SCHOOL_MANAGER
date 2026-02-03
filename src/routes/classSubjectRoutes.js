const express = require('express');
const router = express.Router();
const {
  getClassSubjects,
  getClassSubject,
  createClassSubject,
  updateClassSubject,
  deleteClassSubject
} = require('../controllers/classSubjectController');
const { protect, checkPermission } = require('../middleware/auth');
const { mongoIdValidator, paginationValidator } = require('../middleware/validators');

router.use(protect);

router.get('/', checkPermission('class_subjects', 'read'), paginationValidator, getClassSubjects);
router.get('/:id', checkPermission('class_subjects', 'read'), mongoIdValidator, getClassSubject);
router.post('/', checkPermission('class_subjects', 'create'), createClassSubject);
router.put('/:id', checkPermission('class_subjects', 'update'), mongoIdValidator, updateClassSubject);
router.delete('/:id', checkPermission('class_subjects', 'delete'), mongoIdValidator, deleteClassSubject);

module.exports = router;
