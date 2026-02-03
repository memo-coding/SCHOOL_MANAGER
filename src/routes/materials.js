const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { uploadMaterial, getMaterials, deleteMaterial } = require('../controllers/materialController');
const upload = require('../middleware/upload');

router.use(protect);

router.route('/')
    .get(getMaterials)
    .post(authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), upload.single('file'), uploadMaterial);

router.route('/:id')
    .delete(authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), deleteMaterial);

module.exports = router;
