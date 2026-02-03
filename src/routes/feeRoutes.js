const express = require('express');
const router = express.Router();
const {
  getFees,
  getStudentFees,
  createFee,
  recordPayment,
  getClassFeeReport,
  updateFee,
  deleteFee
} = require('../controllers/feeController');
const { protect, checkPermission } = require('../middleware/auth');
const { feeValidators, mongoIdValidator, paginationValidator } = require('../middleware/validators');

router.use(protect);

router.get('/', checkPermission('fees', 'read'), paginationValidator, getFees);
router.get('/student/:student_id', checkPermission('fees', 'read'), getStudentFees);
router.get('/class/:class_id/report', checkPermission('reports', 'read'), getClassFeeReport);
router.post('/', checkPermission('fees', 'create'), feeValidators.create, createFee);
router.post('/payment', checkPermission('fees', 'update'), feeValidators.payment, recordPayment);
router.put('/:id', checkPermission('fees', 'update'), mongoIdValidator, updateFee);
router.delete('/:id', checkPermission('fees', 'delete'), mongoIdValidator, deleteFee);

module.exports = router;
