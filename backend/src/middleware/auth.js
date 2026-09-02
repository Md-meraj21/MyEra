const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token and attach user to request object
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'myera_super_secret_jwt_key_smart_classroom_2026';

    const decoded = jwt.verify(token, secret);
    req.user = decoded; // Contains id, email, role, etc.
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session token has expired. Please log in again.'
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Invalid or corrupted token.'
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - e.g. ['teacher'], ['student'], or ['teacher', 'student']
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Only [${allowedRoles.join(', ')}] can perform this action.`
      });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  requireRole
};
