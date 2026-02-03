const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(protect);

router.route('/')
    .get(authorize(ROLES.SUPER_ADMIN), getAllUsers)
    .post(authorize(ROLES.SUPER_ADMIN), createUser);
router.route('/:id')
    .put(authorize(ROLES.SUPER_ADMIN), updateUser)
    .delete(authorize(ROLES.SUPER_ADMIN), deleteUser);

module.exports = router;
