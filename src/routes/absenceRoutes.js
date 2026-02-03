const express = require('express');
const router = express.Router();
const {
  getAbsences,
  getAbsence,
  createAbsence,
  updateAbsence,
  deleteAbsence,
  getStudentAbsenceReport
} = require('../controllers/absenceController');
const { protect, checkPermission } = require('../middleware/auth');
const { absenceValidators, mongoIdValidator, paginationValidator } = require('../middleware/validators');

router.use(protect);

router.get('/', checkPermission('absences', 'read'), paginationValidator, getAbsences);
router.get('/student/:student_id/report', checkPermission('reports', 'read'), getStudentAbsenceReport);
router.get('/:id', checkPermission('absences', 'read'), mongoIdValidator, getAbsence);
router.post('/', checkPermission('absences', 'create'), absenceValidators.create, createAbsence);
router.put('/:id', checkPermission('absences', 'update'), absenceValidators.update, updateAbsence);
router.delete('/:id', checkPermission('absences', 'delete'), mongoIdValidator, deleteAbsence);

module.exports = router;
