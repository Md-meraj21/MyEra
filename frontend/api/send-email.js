import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { to, subject, html, auth, from, senderEmail } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, error: 'Missing required email fields (to, subject, html)' });
    }

    const user = auth?.user || process.env.SMTP_USER || 'kb759827@gmail.com';
    const pass = auth?.pass || process.env.SMTP_PASS || 'zwyi izrd cooa wets';

    if (!user || !pass) {
      return res.status(400).json({ success: false, error: 'SMTP credentials missing' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    const info = await transporter.sendMail({
      from: from || `"MyEra Smart Classroom" <${senderEmail || user}>`,
      to,
      subject,
      html
    });

    console.log(`✅ [Vercel Email Relay] Successfully sent email to ${to}: ${info.messageId}`);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('❌ [Vercel Email Relay] Error sending email:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
