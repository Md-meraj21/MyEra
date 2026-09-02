const express = require('express');
const router = express.Router();
const {
  markAttendance,
  getAttendanceStrip,
  getAttendanceHistory
} = require('../controllers/studentController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.post('/mark-attendance', verifyToken, requireRole(['student']), markAttendance);
router.get('/strip/:id', verifyToken, requireRole(['student', 'teacher']), getAttendanceStrip);
router.get('/history/:id', verifyToken, requireRole(['student', 'teacher']), getAttendanceHistory);

module.exports = router;
