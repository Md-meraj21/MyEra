const mongoose = require('mongoose');
const Student = require('../models/Student');
const Session = require('../models/Session');
const { checkLocation } = require('../utils/locationCheck');

/**
 * Mark Attendance using 4-digit code + GPS Verification (30 meters radius)
 * POST /api/student/mark-attendance
 */
exports.markAttendance = async (req, res) => {
  try {
    const { code, lat, lng } = req.body;
    const studentId = req.body.studentId || req.user?.id;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid Student ID is required.'
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the 4-digit session code.'
      });
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS location (lat, lng) is required for location verification.'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.'
      });
    }

    // Find active session matching code
    const session = await Session.findOne({
      code: code.toString().trim(),
      status: 'active'
    });

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session code or session has expired.'
      });
    }

    // Check if session has timed out (2 minutes limit)
    const now = new Date();
    if (now > new Date(session.expiresAt)) {
      session.status = 'expired';
      await session.save();
      return res.status(400).json({
        success: false,
        message: 'This attendance session has expired (exceeded 2 minutes limit).'
      });
    }

    // Check if class & section match (case-insensitive & trimmed)
    if (
      session.class.trim().toLowerCase() !== student.class.trim().toLowerCase() ||
      session.section.trim().toLowerCase() !== student.section.trim().toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        message: `This session is for Class ${session.class}-${session.section}. You are enrolled in ${student.class}-${student.section}.`
      });
    }

    // Check if student has already marked attendance for this session
    const alreadyMarked = session.students.some(
      (entry) => entry.studentId.toString() === student._id.toString()
    );

    if (alreadyMarked) {
      return res.status(400).json({
        success: false,
        message: 'You have already marked attendance for this session.'
      });
    }

    // Perform GPS Location Verification (Radius: 30 meters)
    const studentLocation = { lat: numLat, lng: numLng };
    const { isWithinRange, distance } = checkLocation(session.teacherLocation, studentLocation, 30);

    if (!isWithinRange) {
      return res.status(403).json({
        success: false,
        message: `GPS Verification Failed: You are ${distance} meters away from the classroom. You must be within 30 meters of the teacher.`,
        distance,
        allowedRadius: 30
      });
    }

    // Record attendance in Session
    const attendanceEntry = {
      studentId: student._id,
      markedAt: now,
      status: 'present'
    };
    session.students.push(attendanceEntry);
    await session.save();

    // Record attendance in Student profile
    student.attendance.push({
      sessionId: session._id,
      subject: session.subject,
      date: now,
      status: 'present'
    });
    await student.save();

    return res.status(200).json({
      success: true,
      message: 'Attendance marked successfully!',
      data: {
        subject: session.subject,
        class: session.class,
        section: session.section,
        markedAt: now,
        distanceMeters: distance,
        status: 'present'
      }
    });
  } catch (error) {
    console.error('Error in markAttendance:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while marking attendance.'
    });
  }
};

/**
 * Helper to determine color and status tag based on attendance percentage
 */
const getStatusMeta = (percentage) => {
  if (percentage >= 75) {
    return {
      color: '#22c55e', // Green
      tailwindColor: 'text-green-600 bg-green-500 border-green-500',
      badgeBg: 'bg-green-100 text-green-800 border-green-300',
      status: 'Regular',
      label: 'Regular'
    };
  } else if (percentage >= 50) {
    return {
      color: '#eab308', // Yellow
      tailwindColor: 'text-yellow-600 bg-yellow-500 border-yellow-500',
      badgeBg: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      status: 'Needs Improvement',
      label: 'Needs Improvement'
    };
  } else {
    return {
      color: '#ef4444', // Red
      tailwindColor: 'text-red-600 bg-red-500 border-red-500',
      badgeBg: 'bg-red-100 text-red-800 border-red-300',
      status: 'Irregular',
      label: 'Irregular'
    };
  }
};

/**
 * Get attendance strip & subject-wise stats for a student
 * GET /api/student/strip/:id
 */
exports.getAttendanceStrip = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Student ID.'
      });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.'
      });
    }

    // Find all sessions that have occurred for this student's class and section (case-insensitive)
    const totalSessions = await Session.find({
      class: new RegExp(`^${student.class.trim()}$`, 'i'),
      section: new RegExp(`^${student.section.trim()}$`, 'i')
    });

    const totalSessionsCount = totalSessions.length;
    const presentCount = student.attendance.filter((a) => a.status === 'present').length;
    const absentCount = Math.max(0, totalSessionsCount - presentCount);

    const overallPercentage = totalSessionsCount > 0
      ? Math.round((presentCount / totalSessionsCount) * 100)
      : (presentCount > 0 ? 100 : 0);

    const overallMeta = getStatusMeta(overallPercentage);

    // Subject-wise calculation
    const subjectStatsMap = new Map();

    // Group total sessions by subject
    totalSessions.forEach((sess) => {
      const subj = sess.subject;
      if (!subjectStatsMap.has(subj)) {
        subjectStatsMap.set(subj, { total: 0, present: 0 });
      }
      subjectStatsMap.get(subj).total += 1;
    });

    // Group student's present attendance by subject
    student.attendance.forEach((att) => {
      if (att.status === 'present') {
        const subj = att.subject;
        if (!subjectStatsMap.has(subj)) {
          subjectStatsMap.set(subj, { total: 1, present: 0 });
        }
        subjectStatsMap.get(subj).present += 1;
      }
    });

    const subjectStrips = [];
    subjectStatsMap.forEach((val, subject) => {
      const pct = val.total > 0 ? Math.round((val.present / val.total) * 100) : 0;
      const meta = getStatusMeta(pct);
      subjectStrips.push({
        subject,
        totalClasses: val.total,
        presentClasses: val.present,
        absentClasses: Math.max(0, val.total - val.present),
        percentage: pct,
        color: meta.color,
        status: meta.status,
        badgeBg: meta.badgeBg
      });
    });

    return res.status(200).json({
      success: true,
      student: {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        class: student.class,
        section: student.section
      },
      overall: {
        totalSessions: totalSessionsCount || student.attendance.length,
        presentSessions: presentCount,
        absentSessions: absentCount,
        percentage: overallPercentage,
        color: overallMeta.color,
        status: overallMeta.status,
        badgeBg: overallMeta.badgeBg
      },
      subjectStrips
    });
  } catch (error) {
    console.error('Error in getAttendanceStrip:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while calculating attendance strip.'
    });
  }
};

/**
 * Get full attendance history for a student
 * GET /api/student/history/:id
 */
exports.getAttendanceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Student ID.'
      });
    }

    const student = await Student.findById(id).populate('attendance.sessionId', 'code createdAt teacherId');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.'
      });
    }

    const history = student.attendance
      .map((entry) => ({
        id: entry._id,
        sessionId: entry.sessionId?._id || entry.sessionId,
        subject: entry.subject,
        date: entry.date,
        status: entry.status,
        code: entry.sessionId?.code || 'N/A'
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('Error in getAttendanceHistory:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching attendance history.'
    });
  }
};
