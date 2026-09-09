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
      teacherEmail: customTeacherEmail
    } = req.body;

    if (!subject || !className) {
      return res.status(400).json({
        success: false,
        message: 'Subject and Class are required to send class reminders.'
      });
    }

    // Resolve teacher
    let teacher = null;
    const resolvedTeacherId = teacherId || (req.user && req.user.id);
    if (resolvedTeacherId) {
      teacher = await Teacher.findById(resolvedTeacherId);
    }

    const finalTeacherName = customTeacherName || teacher?.name || (req.user && req.user.name) || 'Faculty Member';
    const finalTeacherEmail = customTeacherEmail || teacher?.email || (req.user && req.user.email);
    const teacherTokens = teacher?.notificationTokens || [];

    const cleanClass = (className || '').trim();
    const cleanSection = (section || '').trim();

    // Query students belonging to this class & section
    const studentQuery = {
      class: { $regex: new RegExp(`^${cleanClass}$`, 'i') }
    };
    if (cleanSection) {
      studentQuery.section = { $regex: new RegExp(`^${cleanSection}$`, 'i') };
    }

    const students = await Student.find(studentQuery).select('name email notificationTokens');

    console.log(`📢 [ClassReminder] Found ${students.length} student(s) for ${cleanClass}-${cleanSection} (${subject})`);

    // 1. Send individual Emails to students
    const emailPromises = students
      .filter((s) => Boolean(s.email))
      .map((s) =>
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

    // 2. Multicast push to all student device tokens
    const studentTokens = [];
    students.forEach((s) => {
      if (Array.isArray(s.notificationTokens)) {
        studentTokens.push(...s.notificationTokens);
      }
    });

    let pushResult = null;
    if (studentTokens.length > 0) {
      const startTimeStr = time ? time.split('-')[0].trim() : 'soon';
      pushResult = await sendPushNotification({
        tokens: studentTokens,
        title: `🎒 Class in 5 Mins: ${subject}`,
        body: `${subject} with ${finalTeacherName} starts at ${startTimeStr}. Open MyEra to mark your attendance!`,
        data: {
          url: `${process.env.FRONTEND_URL || 'https://myera-eight.vercel.app'}/student-dashboard`,
          type: 'class_reminder',
          role: 'student'
        }
      });
    }

    // 3. Send confirmation Email & Push to Teacher
    if (finalTeacherEmail) {
      sendClassReminderEmail({
        to: finalTeacherEmail,
        recipientName: finalTeacherName,
        role: 'teacher',
        subject,
        className: cleanClass,
        section: cleanSection,
        period: Number(period) || 1,
        time: time || 'Upcoming slot',
        teacherName: finalTeacherName
      }).catch((e) => console.warn('Teacher email reminder error:', e.message));
    }

    if (teacherTokens.length > 0) {
      const startTimeStr = time ? time.split('-')[0].trim() : 'soon';
      sendPushNotification({
        tokens: teacherTokens,
        title: `⏰ Lecture in 5 Mins: ${subject}`,
        body: `Your lecture for ${cleanClass} (${cleanSection}) starts at ${startTimeStr}.`,
        data: {
          url: `${process.env.FRONTEND_URL || 'https://myera-eight.vercel.app'}/teacher-dashboard`,
          type: 'class_reminder',
          role: 'teacher'
        }
      }).catch((e) => console.warn('Teacher push reminder error:', e.message));
    }

    // Wait for student emails to dispatch
    const emailResults = await Promise.allSettled(emailPromises);
    const successfulEmails = emailResults.filter(
      (r) => r.status === 'fulfilled' && r.value?.success
    ).length;

    let emailWarning = null;
    if (students.length > 0 && successfulEmails === 0) {
      const firstFail = emailResults.find((r) => r.status === 'fulfilled' && !r.value?.success);
      emailWarning = firstFail?.value?.error || 'Email connection could not be established.';
    }

    return res.status(200).json({
      success: true,
      studentCount: students.length,
      successfulEmails,
      emailWarning,
      pushTokensCount: studentTokens.length,
      message: emailWarning
        ? `⚠️ Found ${students.length} student(s), but email delivery issue: ${emailWarning}`
        : `Reminder for "${subject}" dispatched to ${successfulEmails} student(s) in ${cleanClass} (${cleanSection})!`,
      students: students.map((s) => ({ name: s.name, email: s.email }))
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
