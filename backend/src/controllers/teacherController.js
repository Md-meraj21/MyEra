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
 * Start a new Attendance Session (2 minutes validity with 4-digit code & GPS coordinates)
 * POST /api/teacher/start-session
 */
exports.startSession = async (req, res) => {
  try {
    const { subject, class: targetClass, section, lat, lng } = req.body;
    const teacherId = req.body.teacherId || req.user?.id;

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId) || !subject || !targetClass || !section) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid teacherId, subject, class, and section.'
      });
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) {
      return res.status(400).json({
        success: false,
        message: 'Teacher GPS coordinates (lat, lng) must be valid numbers.'
      });
    }

    // Auto-expire any existing active sessions by this teacher
    await Session.updateMany(
      { teacherId, status: 'active' },
      { $set: { status: 'expired' } }
    );

    // Generate unique 4-digit session code
    const code = generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes

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
      createdAt: now,
      expiresAt,
      status: 'active',
      students: []
    });

    await session.save();

    return res.status(201).json({
      success: true,
      message: 'Attendance session started successfully. Code is valid for 2 minutes.',
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
        durationSeconds: 120
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
 * Get single session with live attendance details
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

    // Get all enrolled students in this class and section to know who is absent (case-insensitive)
    const totalEnrolledStudents = await Student.find({
      class: new RegExp(`^${session.class.trim()}$`, 'i'),
      section: new RegExp(`^${session.section.trim()}$`, 'i')
    }).select('name rollNumber email class section');

    const markedMap = new Map();
    session.students.forEach((s) => {
      if (s.studentId) {
        markedMap.set(s.studentId._id.toString(), s);
      }
    });

    const fullAttendanceList = totalEnrolledStudents.map((student) => {
      const mark = markedMap.get(student._id.toString());
      return {
        studentId: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email,
        class: student.class,
        section: student.section,
        status: mark ? mark.status : 'absent',
        markedAt: mark ? mark.markedAt : null
      };
    });

    const presentCount = session.students.filter((s) => s.status === 'present').length;
    const totalStudents = totalEnrolledStudents.length || session.students.length;
    const absentCount = Math.max(0, totalStudents - presentCount);
    const percentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

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
        presentCount,
        absentCount,
        totalStudents,
        percentage,
        attendanceList: fullAttendanceList
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
      filename = `Attendance_${session.subject.replace(/[^a-zA-Z0-9_-]/g, '_')}_${session.class}-${session.section}_${new Date(session.createdAt).toISOString().split('T')[0]}.xlsx`;

      // Get enrolled students (case-insensitive)
      const enrolled = await Student.find({
        class: new RegExp(`^${session.class.trim()}$`, 'i'),
        section: new RegExp(`^${session.section.trim()}$`, 'i')
      }).sort({ rollNumber: 1 });

      const markedMap = new Map();
      session.students.forEach((s) => {
        if (s.studentId) {
          markedMap.set(s.studentId._id.toString(), s);
        }
      });

      const list = enrolled.length > 0
        ? enrolled.map((st) => {
            const mark = markedMap.get(st._id.toString());
            return {
              rollNumber: st.rollNumber,
              name: st.name,
              email: st.email,
              time: mark ? new Date(mark.markedAt).toLocaleTimeString() : '-',
              status: mark ? mark.status.toUpperCase() : 'ABSENT'
            };
          })
        : session.students.map((st) => ({
            rollNumber: st.studentId?.rollNumber || 'N/A',
            name: st.studentId?.name || 'N/A',
            email: st.studentId?.email || 'N/A',
            time: st.markedAt ? new Date(st.markedAt).toLocaleTimeString() : '-',
            status: (st.status || 'PRESENT').toUpperCase()
          }));

      const total = list.length;
      const present = list.filter((r) => r.status === 'PRESENT').length;
      const absent = total - present;
      const percentage = total > 0 ? ((present / total) * 100).toFixed(1) + '%' : '0%';

      rows = list.map((item, index) => ({
        'S.No': index + 1,
        'Roll No': item.rollNumber,
        'Student Name': item.name,
        'Email': item.email,
        'Time': item.time,
        'Status': item.status
      }));

      // Add blank row
      rows.push({});
      // Add Summary Rows
      rows.push({
        'S.No': 'SUMMARY',
        'Roll No': `Subject: ${session.subject}`,
        'Student Name': `Class & Sec: ${session.class} - ${session.section}`,
        'Email': `Date: ${new Date(session.createdAt).toLocaleDateString()}`,
        'Time': `Present: ${present} / ${total}`,
        'Status': `Rate: ${percentage}`
      });
      rows.push({
        'S.No': '',
        'Roll No': 'Total Students',
        'Student Name': total,
        'Email': 'Present',
        'Time': present,
        'Status': `Absent: ${absent}`
      });
    } else {
      // It's a teacher ID, export all session logs
      const teacher = await Teacher.findById(id);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Record not found for given ID.'
        });
      }

      const sessions = await Session.find({ teacherId: id })
        .sort({ createdAt: -1 })
        .populate('students.studentId', 'name rollNumber email');

      filename = `Teacher_${teacher ? teacher.name.replace(/\s+/g, '_') : 'Report'}_Attendance.xlsx`;

      sessions.forEach((s) => {
        s.students.forEach((st) => {
          rows.push({
            'Date': new Date(s.createdAt).toLocaleDateString(),
            'Subject': s.subject,
            'Class': s.class,
            'Section': s.section,
            'Code': s.code,
            'Roll No': st.studentId?.rollNumber || 'N/A',
            'Student Name': st.studentId?.name || 'N/A',
            'Marked Time': st.markedAt ? new Date(st.markedAt).toLocaleTimeString() : '-',
            'Status': (st.status || 'present').toUpperCase()
          });
        });
      });
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
