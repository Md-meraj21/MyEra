const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const jwt = require('jsonwebtoken');

// Middleware to extract optional token without rejecting unauthenticated calls
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'myera_super_secret_jwt_key_smart_classroom_2026';
      req.user = jwt.verify(token, secret);
    } catch (e) {
      // Ignore invalid token in optionalAuth
    }
  }
  next();
};

// Save device FCM token
router.post('/save-token', optionalAuth, notificationController.saveToken);

// Trigger test reminder
router.post('/test-reminder', notificationController.testReminder);

module.exports = router;
