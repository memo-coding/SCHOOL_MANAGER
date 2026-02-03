const jwt = require('jsonwebtoken');
const { User, Permission } = require('../models');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
      errors: ['No token provided']
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        errors: ['Invalid token']
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated',
        errors: ['Account inactive']
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
      errors: ['Invalid token']
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    console.log(`[Authorize] User Role: ${req.user.role}, Allowed Roles: ${roles}`);
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to perform this action',
        errors: [`Role ${req.user.role} is not authorized`]
      });
    }
    next();
  };
};

const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const permission = await Permission.findOne({ role: req.user.role });

      if (!permission) {
        return res.status(403).json({
          success: false,
          message: 'No permissions defined for this role',
          errors: ['Permission configuration missing']
        });
      }

      const resourcePermissions = permission.permissions[resource];

      if (!resourcePermissions || !resourcePermissions[action]) {
        return res.status(403).json({
          success: false,
          message: `Not authorized to ${action} ${resource}`,
          errors: [`Permission denied for ${action} on ${resource}`]
        });
      }

      next();
    } catch (error) {
      return next(error);
    }
  }
};

const isOwnerOrAdmin = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      if (['super_admin', 'admin'].includes(req.user.role)) {
        return next();
      }

      const resourceUserId = await getResourceUserId(req);

      if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource',
        errors: ['You can only access your own data']
      });
    } catch (error) {
      return next(error);
    }
  }
};

module.exports = {
  protect,
  authorize,
  checkPermission,
  isOwnerOrAdmin
};
