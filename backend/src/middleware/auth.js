const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { canAccessVideoManagement } = require('../config/roles');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  return next();
};

const requireVideoManagerAccess = (req, res, next) => {
  if (!canAccessVideoManagement(req.user)) {
    return res.status(403).json({ message: 'Video manager access required' });
  }
  return next();
};

const authFromHeaderOrQuery = async (req, res, next) => {
  if (!req.headers.authorization && typeof req.query?.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return auth(req, res, next);
};

module.exports = { auth, authFromHeaderOrQuery, requireRole, requireVideoManagerAccess };
