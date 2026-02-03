const express = require('express');
const router = express.Router();
const {
  getFees,
  getStudentFees,
  createFee,
  recordPayment,
  getClassFeeReport,
  updateFee,
  deleteFee,
  createPaymentIntent,
  handleStripeWebhook
} = require('../controllers/feeController');
const { protect, checkPermission } = require('../middleware/auth');
const { feeValidators, mongoIdValidator, paginationValidator } = require('../middleware/validators');

// Webhook route - MUST be before protect middleware if it needs to be public
router.post('/webhook', handleStripeWebhook);

router.use(protect);

router.get('/', checkPermission('fees', 'read'), paginationValidator, getFees);
router.get('/student/:student_id', checkPermission('fees', 'read'), getStudentFees);
router.get('/class/:class_id/report', checkPermission('reports', 'read'), getClassFeeReport);
router.post('/', checkPermission('fees', 'create'), feeValidators.create, createFee);
router.post('/payment', checkPermission('fees', 'update'), feeValidators.payment, recordPayment);
router.post('/:id/payment-intent', checkPermission('fees', 'update'), mongoIdValidator, createPaymentIntent);
router.put('/:id', checkPermission('fees', 'update'), mongoIdValidator, updateFee);
router.delete('/:id', checkPermission('fees', 'delete'), mongoIdValidator, deleteFee);

module.exports = router;
