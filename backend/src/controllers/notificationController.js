const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { sendClassReminderEmail, sendTestEmail } = require('../services/emailService');
const { sendPushNotification } = require('../services/pushNotificationService');

/**
 * Save / Register an FCM device token for Web Push Notifications
 * POST /api/notifications/save-token
 */
exports.saveToken = async (req, res) => {
  try {
    const { token, role, userId, email } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid notification token is required.'
      });
    }

    const targetRole = role || (req.user && req.user.role) || 'student';
    const targetUserId = userId || (req.user && req.user.id);
    const targetEmail = email || (req.user && req.user.email);

    let updated = false;

    if (targetRole === 'teacher') {
      const query = targetUserId ? { _id: targetUserId } : targetEmail ? { email: targetEmail } : null;
      if (query) {
        await Teacher.updateOne(query, { $addToSet: { notificationTokens: token } });
        updated = true;
      }
    } else {
      const query = targetUserId ? { _id: targetUserId } : targetEmail ? { email: targetEmail } : null;
      if (query) {
        await Student.updateOne(query, { $addToSet: { notificationTokens: token } });
        updated = true;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Device successfully registered for class reminders.',
      registered: updated
    });
  } catch (err) {
    console.error('Error saving notification token:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save notification token.',
      error: err.message
    });
  }
};

/**
 * Trigger a quick test reminder (Email or Push)
 * POST /api/notifications/test-reminder
 */
exports.testReminder = async (req, res) => {
  try {
    const {
      email,
      token,
      subject = 'Machine Learning',
      className = 'Cse-A',
      section = 'A',
      period = 1,
      time = '12:07 PM - 01:00 PM',
      teacherName = 'Er. Rupali',
      role = 'teacher'
    } = req.body;

    const results = {};

    if (email) {
      const emailRes = await sendTestEmail({
        to: email,
        recipientName: teacherName || (role === 'teacher' ? 'Faculty Member' : 'Student'),
        role,
        subject,
        className,
        section,
        period,
        time,
        teacherName
      });
      results.email = emailRes;
    }

    if (token) {
      const pushRes = await sendPushNotification({
        tokens: [token],
        title: `⏰ Class Reminder: ${subject}`,
        body: `Upcoming ${subject} lecture with ${teacherName} starts at ${time.split('-')[0].trim()}.`,
        data: { test: 'true', url: 'https://myera-eight.vercel.app' }
      });
      results.push = pushRes;
    }

    const emailOk = results.email ? results.email.success : true;
    const pushOk = results.push ? results.push.success : true;

    if (!emailOk && !pushOk) {
      return res.status(400).json({
        success: false,
        message: results.email?.error || results.push?.error || 'Both Email and Push failed to deliver.',
        results
      });
    }

    return res.status(200).json({
      success: true,
      message: `Test reminder dispatched to ${email || 'device'}.`,
      results
    });
  } catch (err) {
    console.error('Error sending test reminder:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger test reminder.',
      error: err.message
    });
  }
};

// Helper to match student stream/branch flexibly (e.g. CS-4A -> CSE, Civil -> CE, etc.)
const buildStudentClassFilter = (className, section) => {
  if (!className) return {};
  const raw = String(className).trim().toUpperCase();

  let classRegex;
  if (/^(CS|CSE|COMPUTER)/.test(raw)) {
    classRegex = /^(CS|CSE|COMPUTER)/i;
  } else if (/^(CIVIL|CE)/.test(raw)) {
    classRegex = /^(CIVIL|CE)/i;
  } else if (/^(MECH|MECHANICAL|ME)/.test(raw)) {
    classRegex = /^(MECH|MECHANICAL|ME)/i;
  } else if (/^(ELECTRICAL|EE|EEE)/.test(raw)) {
    classRegex = /^(ELECTRICAL|EE|EEE)/i;
  } else if (/^(ELECTRONICS|ECE)/.test(raw)) {
    classRegex = /^(ELECTRONICS|ECE)/i;
  } else {
    const cleanPrefix = raw.replace(/[-_\s]*\d+.*$/, '').trim();
    if (cleanPrefix.length >= 2) {
      classRegex = new RegExp(`^(${raw}|${cleanPrefix})`, 'i');
    } else {
      classRegex = new RegExp(`^${raw}`, 'i');
    }
  }

  const query = { class: { $regex: classRegex } };

  const cleanSec = (section || '').trim();
  if (cleanSec) {
    query.$or = [
      { section: { $regex: new RegExp(`^${cleanSec}$`, 'i') } },
      { section: { $exists: false } },
      { section: '' },
      { section: null }
    ];
  }

  return query;
};

/**
 * Send customized class reminder to all students enrolled in a class/section
 * POST /api/notifications/send-class-reminder
 */
exports.sendClassReminderToStudents = async (req, res) => {
  try {
    const {
      subject,
      class: className,
      section,
      period = 1,
      time = '',
      teacherName: customTeacherName,
      teacherId,
      teacherEmail: reqTeacherEmail,
      teacherToken
    } = req.body;

    if (!subject || !className) {
      return res.status(400).json({
        success: false,
        message: 'Subject and Class are required to send class reminders.'
      });
    }

    // Resolve teacher name for student email content
    let teacher = null;
    const resolvedTeacherId = teacherId || (req.user && req.user.id);
    if (resolvedTeacherId) {
      teacher = await Teacher.findById(resolvedTeacherId);
    }

    const finalTeacherName = customTeacherName || teacher?.name || (req.user && req.user.name) || 'Faculty Member';
    const teacherEmail = (
      reqTeacherEmail ||
      teacher?.email ||
      (req.user && req.user.email) ||
      ''
    ).trim().toLowerCase();

    // Collect all tokens belonging to the teacher to strictly exclude them from push notifications
    const excludeTokens = new Set();
    if (teacherToken) {
      excludeTokens.add(teacherToken);
    }
    if (teacher && Array.isArray(teacher.notificationTokens)) {
      teacher.notificationTokens.forEach((t) => {
        if (t) excludeTokens.add(t);
      });
    }
    if (teacherEmail) {
      const teachersWithEmail = await Teacher.find({
        email: new RegExp(`^${teacherEmail}$`, 'i')
      }).select('notificationTokens');
      teachersWithEmail.forEach((td) => {
        if (Array.isArray(td.notificationTokens)) {
          td.notificationTokens.forEach((t) => {
            if (t) excludeTokens.add(t);
          });
        }
      });
    }

    const cleanClass = (className || '').trim();
    const cleanSection = (section || '').trim();

    // Query students belonging to this stream / branch & section
    const studentQuery = buildStudentClassFilter(cleanClass, cleanSection);
    const students = await Student.find(studentQuery).select('name email notificationTokens class section');

    console.log(`📢 [ClassReminder] Found ${students.length} student(s) for stream "${cleanClass}" (Section ${cleanSection || 'Any'}) for subject "${subject}"`);

    // 1. Send individual Emails ONLY to students (excluding the teacher's email)
    const eligibleStudents = students.filter((s) => {
      if (!s.email) return false;
      if (teacherEmail && s.email.trim().toLowerCase() === teacherEmail) {
        return false;
      }
      return true;
    });

    const emailPromises = eligibleStudents.map((s) =>
      sendClassReminderEmail({
        to: s.email,
        recipientName: s.name,
        role: 'student',
        subject,
        className: cleanClass,
        section: cleanSection,
        period: Number(period) || 1,
        time: time || 'Upcoming slot',
        teacherName: finalTeacherName
      }).catch((e) => ({ success: false, error: e.message }))
    );

    // 2. Multicast push to student device tokens (excluding any tokens belonging to teacher)
    const studentTokens = [];
    students.forEach((s) => {
      // Exclude tokens if student account has teacher's email
      if (teacherEmail && s.email && s.email.trim().toLowerCase() === teacherEmail) {
        return;
      }
      if (Array.isArray(s.notificationTokens)) {
        s.notificationTokens.forEach((tok) => {
          if (tok && !excludeTokens.has(tok)) {
            studentTokens.push(tok);
          }
        });
      }
    });

    const uniqueStudentTokens = Array.from(new Set(studentTokens));

    let pushResult = null;
    if (uniqueStudentTokens.length > 0) {
      const startTimeStr = time ? time.split('-')[0].trim() : 'soon';
      pushResult = await sendPushNotification({
        tokens: uniqueStudentTokens,
        title: `🎒 Class in 5 Mins: ${subject}`,
        body: `${subject} with ${finalTeacherName} starts at ${startTimeStr}. Open MyEra to mark your attendance!`,
        data: {
          url: `${process.env.FRONTEND_URL || 'https://myera-eight.vercel.app'}/student`,
          type: 'class_reminder',
          role: 'student'
        }
      });
    }

    // Wait for all student emails to dispatch
    const emailResults = await Promise.allSettled(emailPromises);

    const successfulEmails = emailResults.filter(
      (r) => r.status === 'fulfilled' && r.value?.success
    ).length;

    let emailWarning = null;
    if (eligibleStudents.length > 0 && successfulEmails === 0) {
      const firstFail = emailResults.find((r) => r.status === 'fulfilled' && !r.value?.success);
      emailWarning = firstFail?.value?.error || 'Email connection could not be established.';
    }

    return res.status(200).json({
      success: true,
      studentCount: eligibleStudents.length,
      successfulEmails,
      emailWarning,
      pushTokensCount: uniqueStudentTokens.length,
      message: emailWarning
        ? `⚠️ Found ${eligibleStudents.length} student(s), but email delivery issue: ${emailWarning}`
        : `Reminder for "${subject}" successfully sent to ${successfulEmails} student(s) of ${cleanClass}!`,
      students: eligibleStudents.map((s) => ({ name: s.name, email: s.email, class: s.class, section: s.section }))
    });
  } catch (err) {
    console.error('Error in sendClassReminderToStudents:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send class reminder to students.',
      error: err.message
    });
  }
};
