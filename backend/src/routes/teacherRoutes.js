const express = require('express');
const router = express.Router();
const {
  addTimetable,
  getTimetable,
  startSession,
  extendSession,
  endSession,
  deleteSession,
  getSessions,
  getSessionDetails,
  getReport,
  downloadExcel
} = require('../controllers/teacherController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Public or token-authenticated teacher routes
router.post('/timetable', verifyToken, requireRole(['teacher']), addTimetable);
router.get('/timetable/:id', verifyToken, getTimetable);
router.post('/start-session', verifyToken, requireRole(['teacher']), startSession);
router.post('/extend-session', verifyToken, requireRole(['teacher']), extendSession);
router.post('/end-session', verifyToken, requireRole(['teacher']), endSession);
router.get('/sessions/:id', verifyToken, requireRole(['teacher']), getSessions);
router.get('/session/:sessionId', verifyToken, getSessionDetails);
router.get('/report/:id', verifyToken, requireRole(['teacher']), getReport);
router.get('/download/:id', downloadExcel); // allow direct download or token
router.delete('/session/:sessionId', verifyToken, requireRole(['teacher']), deleteSession);

module.exports = router;
