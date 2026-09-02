const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');

const generateJwtToken = (payload) => {
  const secret = process.env.JWT_SECRET || 'myera_super_secret_jwt_key_smart_classroom_2026';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

/**
 * Register a new Teacher
 * POST /api/auth/register-teacher
 */
exports.registerTeacher = async (req, res) => {
  try {
    const { name, email, password, subject } = req.body;

    if (!name || !email || !password || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and subject.'
      });
    }

    const existingTeacher = await Teacher.findOne({ email: email.toLowerCase().trim() });
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: 'Teacher with this email already exists.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const teacher = new Teacher({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      subject: subject.trim(),
      timetable: []
    });

    await teacher.save();

    const token = generateJwtToken({
      id: teacher._id,
      email: teacher.email,
      role: 'teacher',
      name: teacher.name,
      subject: teacher.subject
    });

    return res.status(201).json({
      success: true,
      message: 'Teacher registered successfully',
      token,
      user: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        subject: teacher.subject,
        role: 'teacher'
      }
    });
  } catch (error) {
    console.error('Error in registerTeacher:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while registering teacher.'
    });
  }
};

/**
 * Teacher Login
 * POST /api/auth/teacher-login
 */
exports.teacherLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    const teacher = await Teacher.findOne({ email: email.toLowerCase().trim() });
    if (!teacher) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = generateJwtToken({
      id: teacher._id,
      email: teacher.email,
      role: 'teacher',
      name: teacher.name,
      subject: teacher.subject
    });

    return res.status(200).json({
      success: true,
      message: 'Teacher logged in successfully',
      token,
      user: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        subject: teacher.subject,
        role: 'teacher'
      }
    });
  } catch (error) {
    console.error('Error in teacherLogin:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while logging in teacher.'
    });
  }
};

/**
 * Register a new Student
 * POST /api/auth/register-student
 */
exports.registerStudent = async (req, res) => {
  try {
    const { name, email, password, rollNumber, class: studentClass, section } = req.body;

    if (!name || !email || !password || !rollNumber || !studentClass || !section) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password, rollNumber, class, and section.'
      });
    }

    const existingStudent = await Student.findOne({ email: email.toLowerCase().trim() });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this email already exists.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const student = new Student({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      rollNumber: rollNumber.trim(),
      class: studentClass.trim(),
      section: section.trim(),
      attendance: []
    });

    await student.save();

    const token = generateJwtToken({
      id: student._id,
      email: student.email,
      role: 'student',
      name: student.name,
      rollNumber: student.rollNumber,
      class: student.class,
      section: student.section
    });

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        class: student.class,
        section: student.section,
        role: 'student'
      }
    });
  } catch (error) {
    console.error('Error in registerStudent:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while registering student.'
    });
  }
};

/**
 * Student Login
 * POST /api/auth/student-login
 */
exports.studentLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    const student = await Student.findOne({ email: email.toLowerCase().trim() });
    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = generateJwtToken({
      id: student._id,
      email: student.email,
      role: 'student',
      name: student.name,
      rollNumber: student.rollNumber,
      class: student.class,
      section: student.section
    });

    return res.status(200).json({
      success: true,
      message: 'Student logged in successfully',
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        class: student.class,
        section: student.section,
        role: 'student'
      }
    });
  } catch (error) {
    console.error('Error in studentLogin:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while logging in student.'
    });
  }
};
