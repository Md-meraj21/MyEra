const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Session = require('../models/Session');
const generateCode = require('../utils/generateCode');

/**
 * Add or update teacher's timetable
 * POST /api/teacher/timetable
 */
exports.addTimetable = async (req, res) => {
  try {
    const { teacherId, timetable } = req.body;
    const targetTeacherId = teacherId || req.user?.id;

    if (!targetTeacherId || !mongoose.Types.ObjectId.isValid(targetTeacherId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid Teacher ID is required.'
      });
    }

    if (!Array.isArray(timetable)) {
      return res.status(400).json({
        success: false,
        message: 'Timetable must be an array of schedule entries.'
      });
    }

    const teacher = await Teacher.findById(targetTeacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found.'
      });
    }

    teacher.timetable = timetable;
    await teacher.save();

    return res.status(200).json({
      success: true,
      message: 'Timetable updated successfully.',
      timetable: teacher.timetable
    });
  } catch (error) {
    console.error('Error in addTimetable:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while saving timetable.'
    });
  }
};

/**
 * Get teacher's timetable
 * GET /api/teacher/timetable/:id
 */
exports.getTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Teacher ID.'
      });
    }

    const teacher = await Teacher.findById(id).select('name email subject timetable');

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found.'
      });
    }

    return res.status(200).json({
      success: true,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        subject: teacher.subject
      },
      timetable: teacher.timetable
    });
  } catch (error) {
    console.error('Error in getTimetable:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching timetable.'
    });
  }
};

/**
 * Start a new Attendance Session (Custom validity with 4-digit code & GPS coordinates)
 * POST /api/teacher/start-session
 */
exports.startSession = async (req, res) => {
  try {
    const { subject, class: targetClass, section, lat, lng, durationMinutes, radius } = req.body;
    const teacherId = req.body.teacherId || req.user?.id;

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId) || !subject || !targetClass || !section) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid teacherId, subject, class, and section.'
      });
    }

    const validRadius = radius !== undefined ? Math.max(0, parseInt(radius, 10)) : 200;

    const numLat = parseFloat(lat) || 0;
    const numLng = parseFloat(lng) || 0;

    // If GPS is ON (radius > 0), coordinates must be real
    if (validRadius > 0 && (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng)))) {
      return res.status(400).json({
        success: false,
        message: 'GPS is enabled but valid coordinates were not provided. Try again or set radius to Off.'
      });
    }

    // Auto-expire any existing active sessions by this teacher
    await Session.updateMany(
      { teacherId, status: 'active' },
      { $set: { status: 'expired' } }
    );

    // Duration in minutes (default 5 min if not specified or invalid)
    const validDuration = Math.max(1, Math.min(180, parseInt(durationMinutes, 10) || 5));

    // Generate unique 4-digit session code
    const code = generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validDuration * 60 * 1000);

    const session = new Session({
      teacherId,
      subject: subject.trim(),
      class: targetClass.trim(),
      section: section.trim(),
      code,
      teacherLocation: {
        lat: numLat,
        lng: numLng
      },
      durationMinutes: validDuration,
      radius: validRadius,
      createdAt: now,
      expiresAt,
      status: 'active',
      students: []
    });

    await session.save();

    return res.status(201).json({
      success: true,
      message: `Attendance session started! Code: ${session.code} (Active for ${validDuration} mins)`,
      session: {
        id: session._id,
        code: session.code,
        subject: session.subject,
        class: session.class,
        section: session.section,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        status: session.status,
        teacherLocation: session.teacherLocation,
        durationMinutes: validDuration,
        radius: validRadius,
        durationSeconds: validDuration * 60
      }
    });
  } catch (error) {
    console.error('Error in startSession:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while starting session.'
    });
  }
};

/**
 * Extend an active session by additional minutes
 * POST /api/teacher/extend-session
 */
exports.extendSession = async (req, res) => {
  try {
    const { sessionId, extraMinutes = 2 } = req.body;
    const teacherId = req.body.teacherId || req.user?.id;

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid Session ID is required.'
      });
    }

    const session = await Session.findOne({ _id: sessionId, teacherId });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found.'
      });
    }

    const addMs = Math.max(1, parseInt(extraMinutes, 10) || 2) * 60 * 1000;
    const baseTime = session.status === 'active' && new Date(session.expiresAt) > new Date()
      ? new Date(session.expiresAt).getTime()
      : Date.now();

    session.expiresAt = new Date(baseTime + addMs);
    session.status = 'active';
    await session.save();

    return res.status(200).json({
      success: true,
      message: `Session extended by ${extraMinutes} minutes.`,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error('Error in extendSession:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while extending session.'
    });
  }
};

/**
 * Manually end/expire an active session immediately
 * POST /api/teacher/end-session
 */
exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const teacherId = req.body.teacherId || req.user?.id;

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid Session ID is required.'
      });
    }

    const session = await Session.findOneAndUpdate(
      { _id: sessionId, teacherId },
      { $set: { status: 'expired', expiresAt: new Date() } },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Session ended successfully.',
      session
    });
  } catch (error) {
    console.error('Error in endSession:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while ending session.'
    });
  }
};

/**
 * Permanently delete a session record from history
 * DELETE /api/teacher/session/:sessionId
 */
exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const teacherId = req.user?.id || req.user?._id;

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid Session ID is required.'
      });
    }

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const session = await Session.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(sessionId),
      $or: [
        { teacherId: teacherId },
        { teacherId: new mongoose.Types.ObjectId(teacherId) }
      ]
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unauthorized.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Session deleted from history.'
    });
  } catch (error) {
    console.error('Error in deleteSession:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while deleting session.'
    });
  }
};

/**
 * Get all sessions started by a teacher
 * GET /api/teacher/sessions/:id
 */
exports.getSessions = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Teacher ID.'
      });
    }

    // Check and update expired sessions
    const now = new Date();
    await Session.updateMany(
      { teacherId: id, status: 'active', expiresAt: { $lt: now } },
      { $set: { status: 'expired' } }
    );

    const sessions = await Session.find({ teacherId: id })
      .sort({ createdAt: -1 })
      .populate('students.studentId', 'name rollNumber email class section');

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions
    });
  } catch (error) {
    console.error('Error in getSessions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching sessions.'
    });
  }
};

/**
 * Get single session with live attendance details (ONLY Present Students shown)
 * GET /api/teacher/session/:sessionId
 */
exports.getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Session ID.'
      });
    }

    const session = await Session.findById(sessionId).populate(
      'students.studentId',
      'name rollNumber email class section'
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    // Check expiration
    if (session.status === 'active' && new Date() > new Date(session.expiresAt)) {
      session.status = 'expired';
      await session.save();
    }

    // Filter ONLY students who have actually marked attendance (Present)
    const presentStudentsList = session.students
      .filter((s) => s.status === 'present' && s.studentId)
      .map((s) => ({
        studentId: s.studentId._id,
        rollNumber: s.studentId.rollNumber,
        name: s.studentId.name,
        email: s.studentId.email,
        class: s.studentId.class,
        section: s.studentId.section,
        status: 'present',
        markedAt: s.markedAt
      }));

    // Sort by markedAt time (most recent first)
    presentStudentsList.sort((a, b) => new Date(b.markedAt) - new Date(a.markedAt));

    const presentCount = presentStudentsList.length;

    return res.status(200).json({
      success: true,
      session: {
        id: session._id,
        code: session.code,
        subject: session.subject,
        class: session.class,
        section: session.section,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        status: session.status,
        teacherLocation: session.teacherLocation,
        durationMinutes: session.durationMinutes || 5,
        radius: session.radius !== undefined ? session.radius : 200,
        presentCount,
        totalStudents: presentCount,
        attendanceList: presentStudentsList
      }
    });
  } catch (error) {
    console.error('Error in getSessionDetails:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching session details.'
    });
  }
};

/**
 * Get aggregated attendance report for a teacher / class
 * GET /api/teacher/report/:id
 */
exports.getReport = async (req, res) => {
  try {
    const { id } = req.params; // teacherId
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Teacher ID.'
      });
    }

    const sessions = await Session.find({ teacherId: id })
      .sort({ createdAt: -1 })
      .populate('students.studentId', 'name rollNumber email class section');

    let totalSessions = sessions.length;
    let totalPresentMarked = 0;

    const sessionReports = sessions.map((session) => {
      const presentStudents = session.students.filter((s) => s.status === 'present');
      totalPresentMarked += presentStudents.length;

      return {
        sessionId: session._id,
        subject: session.subject,
        class: session.class,
        section: session.section,
        date: session.createdAt,
        code: session.code,
        status: session.status,
        presentCount: presentStudents.length,
        attendees: session.students.map((st) => ({
          studentId: st.studentId?._id,
          name: st.studentId?.name || 'Unknown',
          rollNumber: st.studentId?.rollNumber || 'N/A',
          markedAt: st.markedAt,
          status: st.status
        }))
      };
    });

    return res.status(200).json({
      success: true,
      teacherId: id,
      totalSessions,
      totalPresentMarked,
      sessionReports
    });
  } catch (error) {
    console.error('Error in getReport:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating report.'
    });
  }
};

/**
 * Download attendance report as an Excel (.xlsx) file
 * GET /api/teacher/download/:id
 * :id can be either a specific sessionId or teacherId
 */
exports.downloadExcel = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Session or Teacher ID.'
      });
    }

    // Check if ID is a session
    let session = await Session.findById(id).populate(
      'students.studentId',
      'name rollNumber email class section'
    );

    let rows = [];
    let filename = `attendance_report_${Date.now()}.xlsx`;

    if (session) {
      // Single session download — PRESENT students only, simple 3 columns
      filename = `Attendance_${session.subject.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date(session.createdAt).toISOString().split('T')[0]}.xlsx`;

      const presentStudents = session.students
        .filter(s => s.status === 'present' && s.studentId)
        .sort((a, b) => new Date(a.markedAt) - new Date(b.markedAt));

      if (presentStudents.length === 0) {
        rows.push({ 'Roll No': 'No students marked present', 'Name': '-', 'Subject': session.subject });
      } else {
        presentStudents.forEach((s, i) => {
          rows.push({
            'S.No': i + 1,
            'Roll No': s.studentId.rollNumber || 'N/A',
            'Name': s.studentId.name || 'N/A',
            'Subject': session.subject
          });
        });
      }
    } else {
      // Teacher-level download — all sessions, PRESENT only, simple columns
      const teacher = await Teacher.findById(id);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Record not found for given ID.'
        });
      }

      const sessions = await Session.find({ teacherId: id })
        .sort({ createdAt: -1 })
        .populate('students.studentId', 'name rollNumber');

      filename = `Attendance_${teacher.name.replace(/\s+/g, '_')}.xlsx`;

      const subjectFilter = req.query.subject ? req.query.subject.trim() : null;
      if (subjectFilter) {
        filename = `Attendance_${teacher.name.replace(/\s+/g, '_')}_${subjectFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      }

      let rowIndex = 1;
      sessions.forEach((s) => {
        if (subjectFilter && s.subject.toLowerCase() !== subjectFilter.toLowerCase()) return;
        const presentList = s.students.filter(st => st.status === 'present' && st.studentId);
        presentList.forEach((st) => {
          rows.push({
            'S.No': rowIndex++,
            'Roll No': st.studentId.rollNumber || 'N/A',
            'Name': st.studentId.name || 'N/A',
            'Subject': s.subject,
            'Date': new Date(s.createdAt).toLocaleDateString()
          });
        });
      });

      if (rows.length === 0) {
        rows.push({ 'Roll No': 'No present records found', 'Name': '-', 'Subject': subjectFilter || 'All' });
      }
    }

    if (rows.length === 0) {
      rows.push({
        'Message': 'No attendance records found for the requested query.'
      });
    }

    // Build worksheet and workbook with SheetJS (XLSX)
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Error in downloadExcel:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating Excel file.'
    });
  }
};
