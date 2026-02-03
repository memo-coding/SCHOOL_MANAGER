const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { createCourse, getCourses, addMaterial } = require('../controllers/courseController');
const upload = require('../middleware/upload');

// Base route: /api/courses

router.use(protect);

router.route('/')
    .post(authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), createCourse)
    .get(getCourses);

router.route('/:id/materials')
    .post(authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), upload.single('file'), addMaterial);

module.exports = router;
