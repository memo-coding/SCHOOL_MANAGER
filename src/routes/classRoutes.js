const express = require('express');
const router = express.Router();
const {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass
} = require('../controllers/classController');
const { protect, checkPermission } = require('../middleware/auth');
const { classValidators, mongoIdValidator, paginationValidator } = require('../middleware/validators');

router.use(protect);

router.get('/', checkPermission('classes', 'read'), paginationValidator, getClasses);
router.get('/:id', checkPermission('classes', 'read'), mongoIdValidator, getClass);
router.post('/', checkPermission('classes', 'create'), classValidators.create, createClass);
router.put('/:id', checkPermission('classes', 'update'), classValidators.update, updateClass);
router.delete('/:id', checkPermission('classes', 'delete'), mongoIdValidator, deleteClass);

module.exports = router;
