const cron = require('node-cron');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { sendClassReminderEmail } = require('./emailService');
const { sendPushNotification } = require('./pushNotificationService');

// In-memory set to prevent duplicate alerts for the same class on the same day
const sentRemindersCache = new Set();

/**
 * Parse start time from string like "09:00 AM - 10:00 AM" or "13:30 - 14:30"
 * Returns total minutes since midnight (0 - 1439), or null if unparseable
 */
const parseStartTimeToMinutes = (timeString) => {
  if (!timeString || typeof timeString !== 'string') return null;

  try {
    const firstPart = timeString.split('-')[0].trim();
    // Match "09:00 AM" or "9:00AM" or "14:30" or "09:00"
    const match = firstPart.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3] ? match[3].toUpperCase() : null;

    if (meridian === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridian === 'AM' && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  } catch (err) {
    return null;
  }
};

/**
 * Clean up cache older than today
 */
const pruneOldCache = (todayKey) => {
  for (const key of sentRemindersCache) {
    if (!key.endsWith(todayKey)) {
      sentRemindersCache.delete(key);
    }
  }
};

/**
 * Check and process 5-minute class reminders
 */
const processClassReminders = async () => {
  try {
    const timeZone = process.env.TIMEZONE || 'Asia/Kolkata';
    const now = new Date();

    // 1. Determine Day Name (e.g. 'Monday')
    const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone });
    const currentDay = dayFormatter.format(now);

    // 2. Determine Current Minutes from Midnight
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
      timeZone
    });

    const formattedTime = timeFormatter.format(now);
    const [hourStr, minStr] = formattedTime.split(':');
    const currentTotalMinutes = parseInt(hourStr, 10) * 60 + parseInt(minStr, 10);

    const dateKey = now.toISOString().slice(0, 10);
    pruneOldCache(dateKey);

    // 3. Find teachers who have classes scheduled today (matches "Wednesday" or "Wed")
    const dayPrefix = currentDay.slice(0, 3);
    const teachers = await Teacher.find({
      'timetable.day': { $regex: new RegExp(`^(${currentDay}|${dayPrefix})`, 'i') }
    }).select('name email timetable notificationTokens');

    if (!teachers || teachers.length === 0) {
      return;
    }

    for (const teacher of teachers) {
      const todayEntries = (teacher.timetable || []).filter((entry) => {
        const d = (entry.day || '').toLowerCase();
        return d === currentDay.toLowerCase() || d === dayPrefix.toLowerCase() || currentDay.toLowerCase().startsWith(d);
      });

      for (const entry of todayEntries) {
        const classStartMinutes = parseStartTimeToMinutes(entry.time);
        if (classStartMinutes === null) continue;

        // Reminder condition: upcoming within the next 6 minutes (0 to 6 minutes before start)
        const diffMinutes = classStartMinutes - currentTotalMinutes;

        if (diffMinutes >= 0 && diffMinutes <= 6) {
          const dedupeKey = `${teacher._id}_${entry.day}_${entry.period}_${entry.class}_${entry.section}_${dateKey}`;

          if (sentRemindersCache.has(dedupeKey)) {
            continue;
          }
          sentRemindersCache.add(dedupeKey);

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

          console.log(`⏰ [ReminderScheduler] Triggering 5-minute student alert for "${entry.subject}" (${entry.class}-${entry.section}, ${entry.time})`);

          // Find and Notify Enrolled Students of this stream
          try {
            const cleanClass = (entry.class || '').trim();
            const cleanSection = (entry.section || '').trim();
            const studentQuery = buildStudentClassFilter(cleanClass, cleanSection);
            const students = await Student.find(studentQuery).select('name email notificationTokens class section');

            console.log(`📢 [ReminderScheduler] Found ${students.length} student(s) for stream "${cleanClass}" (Section ${cleanSection || 'Any'}) for "${entry.subject}"`);

            if (students && students.length > 0) {
              const allStudentTokens = [];

              for (const student of students) {
                // Collect FCM push tokens
                if (student.notificationTokens && student.notificationTokens.length > 0) {
                  allStudentTokens.push(...student.notificationTokens);
                }

                // Send individual student email
                if (student.email) {
                  sendClassReminderEmail({
                    to: student.email,
                    recipientName: student.name,
                    role: 'student',
                    subject: entry.subject,
                    className: entry.class,
                    section: entry.section,
                    period: entry.period,
                    time: entry.time,
                    teacherName: teacher.name
                  }).catch((e) => console.error(`[ReminderScheduler] Student email error (${student.email}):`, e.message));
                }
              }

              // Send batch multicast push notifications to all students of this stream
              if (allStudentTokens.length > 0) {
                sendPushNotification({
                  tokens: allStudentTokens,
                  title: `🎒 Class in 5 Mins: ${entry.subject}`,
                  body: `${entry.subject} with ${teacher.name} starts at ${entry.time.split('-')[0].trim()}. Get ready to mark attendance!`,
                  data: {
                    url: `${process.env.FRONTEND_URL || 'https://myera-eight.vercel.app'}/student`,
                    type: 'class_reminder',
                    role: 'student'
                  }
                }).catch((e) => console.error('[ReminderScheduler] Student batch push error:', e.message));
              }
            }
          } catch (studentErr) {
            console.error('[ReminderScheduler] Error querying students:', studentErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ [ReminderScheduler] Error running reminder tick:', err.message);
  }
};

/**
 * Start background cron job running every minute
 */
let cronJobInstance = null;

const startReminderScheduler = () => {
  if (cronJobInstance) {
    console.log('ℹ️ [ReminderScheduler] Scheduler already active.');
    return;
  }

  // Runs every minute on the 0th second: "* * * * *"
  cronJobInstance = cron.schedule('* * * * *', async () => {
    await processClassReminders();
  });

  console.log(`⏱️ [ReminderScheduler] Active: checking class timetables every 60 seconds (Timezone: ${process.env.TIMEZONE || 'Asia/Kolkata'}).`);
};

module.exports = {
  startReminderScheduler,
  processClassReminders,
  parseStartTimeToMinutes
};
