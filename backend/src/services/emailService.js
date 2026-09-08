const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize or get existing Nodemailer transporter
 */
const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587
      auth: {
        user,
        pass
      }
    });
  }

  return transporter;
};

/**
 * Send a modern 5-minute class reminder email to Teacher or Student
 */
const sendClassReminderEmail = async ({
  to,
  recipientName = 'User',
  role = 'student', // 'student' | 'teacher'
  subject = 'Class',
  className = '',
  section = '',
  period = 1,
  time = '',
  teacherName = ''
}) => {
  try {
    const transport = getTransporter();
    const fromAddress = process.env.EMAIL_FROM || `"MyEra Smart Classroom" <${process.env.SMTP_USER || 'no-reply@myera.internal'}>`;
    const frontendUrl = process.env.FRONTEND_URL || 'https://myera-eight.vercel.app';

    if (!transport) {
      console.log(`ℹ️ [EmailService (Dry Run)]: Reminder for "${subject}" (${className}-${section}) ready for ${to}, but SMTP is unconfigured in .env.`);
      return { success: false, reason: 'unconfigured' };
    }

    const isTeacher = role === 'teacher';
    const roleBadgeText = isTeacher ? '👨‍🏫 Teacher Reminder' : '🎒 Student Reminder';
    const actionMessage = isTeacher
      ? 'Your scheduled lecture is about to begin in <strong>5 minutes</strong>. Please prepare your attendance session.'
      : `Your scheduled class with <strong>${teacherName || 'your professor'}</strong> starts in <strong>5 minutes</strong>. Get ready to mark your attendance!`;

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Class Reminder - MyEra</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }
        .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }
        .header p { margin: 6px 0 0; color: #e0e7ff; font-size: 14px; }
        .content { padding: 28px 24px; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; background: rgba(79, 70, 229, 0.2); color: #818cf8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(129, 140, 248, 0.3); margin-bottom: 16px; }
        .alert-box { background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; color: #fde68a; font-size: 14px; line-height: 1.5; }
        .info-card { background: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1e293b; font-size: 14px; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #94a3b8; font-weight: 500; }
        .info-value { color: #f8fafc; font-weight: 600; text-align: right; }
        .button-wrapper { text-align: center; margin: 30px 0 10px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39); }
        .footer { padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; background: #172033; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MyEra Smart Classroom</h1>
          <p>Automated Timetable & Attendance System</p>
        </div>
        <div class="content">
          <div class="badge">${roleBadgeText}</div>
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #ffffff;">Hello ${recipientName},</h2>
          <div class="alert-box">
            ⏰ <strong>5-Minute Alert:</strong> ${actionMessage}
          </div>

          <div class="info-card">
            <div class="info-row">
              <span class="info-label">Subject</span>
              <span class="info-value" style="color: #a5b4fc;">${subject}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Class & Section</span>
              <span class="info-value">${className} (Section ${section})</span>
            </div>
            <div class="info-row">
              <span class="info-label">Period</span>
              <span class="info-value">Period #${period}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Scheduled Time</span>
              <span class="info-value" style="color: #34d399;">${time}</span>
            </div>
            ${teacherName ? `
            <div class="info-row">
              <span class="info-label">Faculty</span>
              <span class="info-value">${teacherName}</span>
            </div>` : ''}
          </div>

          <div class="button-wrapper">
            <a href="${frontendUrl}" class="btn">🚀 Open MyEra Dashboard</a>
          </div>
        </div>
        <div class="footer">
          This is an automated reminder generated by MyEra Classroom Scheduler.<br/>
          &copy; ${new Date().getFullYear()} MyEra. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    `;

    const info = await transport.sendMail({
      from: fromAddress,
      to,
      subject: `⏰ [Reminder] ${subject} starts in 5 minutes (${time})`,
      html: htmlContent
    });

    console.log(`✅ [EmailService] Reminder sent to ${to} for ${subject} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ [EmailService] Failed to send email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send a verification test email
 */
const sendTestEmail = async (to) => {
  return sendClassReminderEmail({
    to,
    recipientName: 'MyEra User',
    role: 'student',
    subject: 'Sample Data Structures & Algorithms',
    className: 'CS-4A',
    section: 'A',
    period: 1,
    time: '09:00 AM - 10:00 AM',
    teacherName: 'Prof. Demo Teacher'
  });
};

module.exports = {
  sendClassReminderEmail,
  sendTestEmail
};
