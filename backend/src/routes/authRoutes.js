const express = require('express');
const router = express.Router();
const {
  registerTeacher,
  teacherLogin,
  registerStudent,
  studentLogin
} = require('../controllers/authController');

router.post('/register-teacher', registerTeacher);
router.post('/teacher-login', teacherLogin);
router.post('/register-student', registerStudent);
router.post('/student-login', studentLogin);

module.exports = router;
