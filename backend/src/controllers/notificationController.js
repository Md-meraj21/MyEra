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
    const { email, token } = req.body;

    const results = {};

    if (email) {
      const emailRes = await sendTestEmail(email);
      results.email = emailRes;
    }

    if (token) {
      const pushRes = await sendPushNotification({
        tokens: [token],
        title: '🔔 Test Reminder: MyEra Smart Classroom',
        body: 'Web push notifications are functioning properly on this device!',
        data: { test: 'true', url: 'https://myera-eight.vercel.app' }
      });
      results.push = pushRes;
    }

    return res.status(200).json({
      success: true,
      message: 'Test reminder dispatched.',
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
