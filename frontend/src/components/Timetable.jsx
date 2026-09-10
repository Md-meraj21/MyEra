import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Play, Trash2, CheckCircle2, AlertCircle, RefreshCw, Bell } from 'lucide-react';
import { notificationAPI } from '../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SAMPLE_TIMETABLE = [
  { day: 'Monday', period: 1, subject: 'Data Structures & Algorithms', class: 'CS-4A', section: 'A', time: '09:00 AM - 10:00 AM' },
  { day: 'Monday', period: 2, subject: 'Operating Systems', class: 'CS-4A', section: 'A', time: '10:00 AM - 11:00 AM' },
  { day: 'Tuesday', period: 1, subject: 'Database Management Systems', class: 'CS-4A', section: 'A', time: '09:00 AM - 10:00 AM' },
  { day: 'Wednesday', period: 3, subject: 'Computer Networks', class: 'CS-4A', section: 'A', time: '11:15 AM - 12:15 PM' },
  { day: 'Thursday', period: 2, subject: 'Software Engineering', class: 'CS-4A', section: 'A', time: '10:00 AM - 11:00 AM' },
  { day: 'Friday', period: 4, subject: 'Discrete Mathematics', class: 'CS-4A', section: 'A', time: '01:30 PM - 02:30 PM' },
];

const Timetable = ({ timetable = [], onSaveTimetable, onStartSession, isTeacher = false, user = null }) => {
  const currentDayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  const [selectedDay, setSelectedDay] = useState(DAYS.includes(currentDayName) ? currentDayName : 'Monday');
  const [showAddModal, setShowAddModal] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notifyingIdx, setNotifyingIdx] = useState(null);
  const [notifyToast, setNotifyToast] = useState(null);

  const [formData, setFormData] = useState({
    day: selectedDay,
    period: 1,
    subject: '',
    class: 'CS-4A',
    section: 'A',
    time: '09:00 AM - 10:00 AM'
  });

  const activeDayList = (timetable.length > 0 ? timetable : DEFAULT_SAMPLE_TIMETABLE).filter(
    (item) => item.day.toLowerCase() === selectedDay.toLowerCase()
  ).sort((a, b) => a.period - b.period);

  // Helper to parse start time string (e.g. "10:30 PM - 10:40 PM")
  const parseStartMinutes = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return null;
    try {
      const firstPart = timeString.split('-')[0].trim();
      const match = firstPart.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const meridian = match[3] ? match[3].toUpperCase() : null;
      if (meridian === 'PM' && hours < 12) hours += 12;
      else if (meridian === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    } catch {
      return null;
    }
  };

  // Automated 5-Minute Class Reminder Watcher (Runs every 30 seconds)
  useEffect(() => {
    if (!timetable || timetable.length === 0) return;

    const checkUpcomingPeriods = () => {
      const now = new Date();
      const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const dateStr = now.toISOString().slice(0, 10);

      const todaySlots = timetable.filter((t) => {
        const d = (t.day || '').toLowerCase();
        return d === todayName.toLowerCase() || todayName.toLowerCase().startsWith(d);
      });

      todaySlots.forEach((slot) => {
        const startMinutes = parseStartMinutes(slot.time);
        if (startMinutes === null) return;

        const diff = startMinutes - currentMinutes;
        // Trigger alert if class starts in 0 to 5 minutes
        if (diff >= 0 && diff <= 5) {
          const sessionKey = `myera_auto_alert_${dateStr}_${slot.day}_${slot.period}_${slot.subject}_${slot.class}`;
          if (sessionStorage.getItem(sessionKey)) return;
          sessionStorage.setItem(sessionKey, 'true');

          const diffText = diff === 0 ? 'Starting right now!' : `Starting in ${diff} minute${diff > 1 ? 's' : ''}!`;

          // 1. Native Desktop/Mobile Push Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`⏰ Upcoming Class: ${slot.subject}`, {
                body: `${slot.class} (${slot.section || 'A'}) • ${diffText}`,
                icon: '/favicon.ico',
                badge: '/favicon.ico'
              });
            } catch (err) {
              console.warn('Native notification notice:', err);
            }
          }

          // 2. In-App Banner
          setNotifyToast({
            type: 'success',
            text: `⏰ Auto Alert: "${slot.subject}" (${slot.class}) is ${diffText}`
          });

          // 3. If teacher, trigger student reminder in background
          if (isTeacher && user) {
            notificationAPI.sendClassReminder({
              subject: slot.subject,
              class: slot.class,
              section: slot.section,
              period: slot.period,
              time: slot.time,
              teacherId: user?._id || user?.id,
              teacherName: user?.name,
              teacherEmail: user?.email
            }).catch((e) => console.warn('Auto background reminder error:', e.message));
          }
        }
      });
    };

    checkUpcomingPeriods();
    const interval = setInterval(checkUpcomingPeriods, 30000);
    return () => clearInterval(interval);
  }, [timetable, isTeacher, user]);

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.class || !formData.section) {
      setFormError('Please fill out all required fields.');
      return;
    }
    setFormError('');

    const updatedList = [...timetable, { ...formData, period: Number(formData.period) }];
    setIsSaving(true);
    try {
      if (onSaveTimetable) {
        await onSaveTimetable(updatedList);
      }
      setShowAddModal(false);
      setFormData({
        day: selectedDay,
        period: (activeDayList.length + 1) || 1,
        subject: '',
        class: 'CS-4A',
        section: 'A',
        time: '09:00 AM - 10:00 AM'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteSlot = async () => {
    if (!slotToDelete) return;
    setIsDeleting(true);
    try {
      const updatedList = timetable.filter((_, idx) => idx !== slotToDelete.rawIndex);
      if (onSaveTimetable) {
        await onSaveTimetable(updatedList);
      }
      setSlotToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmLoadSample = async () => {
    setIsSaving(true);
    try {
      if (onSaveTimetable) {
        await onSaveTimetable(DEFAULT_SAMPLE_TIMETABLE);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotifyStudents = async (slot, idx) => {
    setNotifyingIdx(idx);
    setNotifyToast(null);
    try {
      const res = await notificationAPI.sendClassReminder({
        subject: slot.subject,
        class: slot.class,
        section: slot.section,
        period: slot.period,
        time: slot.time,
        teacherId: user?._id || user?.id,
        teacherName: user?.name,
        teacherEmail: user?.email
      });

      const count = res.data?.studentCount || 0;
      const successfulEmails = res.data?.successfulEmails ?? count;
      const teacherEmailSuccess = res.data?.teacherEmailSuccess ?? true;
      const pushCount = res.data?.pushTokensCount || 0;
      const emailWarning = res.data?.emailWarning;

      const pushMsg = pushCount > 0 
        ? ` • 📱 ${pushCount} Push alert(s) sent`
        : ` • ℹ️ Students have not opened the app to enable push notifications yet`;

      if (emailWarning && successfulEmails === 0) {
        setNotifyToast({
          type: 'error',
          text: `⚠️ Found ${count} student(s), but email delivery error: ${emailWarning}${pushMsg}`
        });
      } else {
        setNotifyToast({
          type: 'success',
          text: `📧 Reminder for "${slot.subject}" delivered to ${successfulEmails} student(s)${teacherEmailSuccess ? ' & your email' : ''}!${pushMsg}`
        });
      }
      setTimeout(() => setNotifyToast(null), 10000);
    } catch (err) {
      setNotifyToast({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to send class reminder to students.'
      });
      setTimeout(() => setNotifyToast(null), 10000);
    } finally {
      setNotifyingIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      {notifyToast && (
        <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-2 text-xs font-semibold border animate-fade-in ${
          notifyToast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {notifyToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notifyToast.text}</span>
          </div>
          <button
            onClick={() => setNotifyToast(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}
      {/* Day Selector Bar */}
      <div className="card-human rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Day Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {DAYS.map((day) => {
            const isToday = day.toLowerCase() === currentDayName.toLowerCase();
            const isSelected = day === selectedDay;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isSelected
                    ? 'btn-bright-blue text-white shadow-sm'
                    : 'text-slate-600 hover:bg-blue-50/80 hover:text-blue-700'
                }`}
              >
                <span>{day.slice(0, 3)}</span>
                {isToday && (
                  <span className={`ml-1 px-1 py-0.2 text-[9px] rounded-full ${isSelected ? 'bg-white/20' : 'bg-blue-600 text-white'}`}>
                    •
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Teacher Action Controls */}
        {isTeacher && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {timetable.length === 0 && (
              <button
                type="button"
                onClick={confirmLoadSample}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition border border-blue-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Load Sample</span>
              </button>
            )}
            <button
              onClick={() => {
                setFormData((prev) => ({ ...prev, day: selectedDay }));
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold btn-bright-blue rounded-xl transition shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Period</span>
            </button>
          </div>
        )}
      </div>

      {/* Timetable Grid for Selected Day */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {activeDayList.length === 0 ? (
          <div className="col-span-full card-human rounded-3xl p-8 text-center space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No periods on {selectedDay}</h4>
            <p className="text-xs text-slate-400">
              {isTeacher
                ? 'Click "Add Period" above to create slots for this day.'
                : 'No lectures scheduled for this day.'}
            </p>
          </div>
        ) : (
          activeDayList.map((slot, idx) => {
            const rawIndex = timetable.findIndex(
              (t) =>
                t.day === slot.day &&
                t.period === slot.period &&
                t.subject === slot.subject &&
                t.class === slot.class
            );

            return (
              <div
                key={idx}
                className="card-human rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                      Period {slot.period}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {slot.time}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 leading-tight">
                    {slot.subject}
                  </h4>

                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 mt-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                      Class: {slot.class}-{slot.section}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-blue-50 flex items-center justify-between gap-2">
                  {isTeacher ? (
                    <>
                      <button
                        onClick={() => onStartSession && onStartSession(slot)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 btn-bright-blue text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start Attendance</span>
                      </button>

                      <button
                        onClick={() => handleNotifyStudents(slot, idx)}
                        disabled={notifyingIdx === idx}
                        title="Send 5-min reminder email & push notification to all students of this class"
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition border border-blue-200 flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                      >
                        <Bell className={`w-3.5 h-3.5 ${notifyingIdx === idx ? 'animate-bounce text-blue-600' : ''}`} />
                        <span className="hidden sm:inline">{notifyingIdx === idx ? 'Sending...' : 'Remind'}</span>
                      </button>

                      {rawIndex !== -1 && (
                        <button
                          onClick={() => setSlotToDelete({ rawIndex, slot })}
                          title="Delete slot"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="w-full text-center py-0.5 text-[11px] text-blue-600/70 font-semibold">
                      Scheduled Lecture Slot
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Period Modal for Teacher */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="card-human rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Add Schedule Slot</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Day</label>
                <select
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Period</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Time</label>
                  <input
                    type="text"
                    placeholder="09:00 AM - 10:00 AM"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures & Algorithms"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class</label>
                  <input
                    type="text"
                    placeholder="CS-4A"
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    placeholder="A"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-blue-50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold btn-bright-blue transition disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Slot Confirmation Modal */}
      {slotToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-human bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Remove Period?</h3>
              <p className="text-xs text-slate-500">
                Remove <strong className="text-slate-800">{slotToDelete.slot.subject}</strong> (Period {slotToDelete.slot.period}) from <strong className="text-slate-800">{slotToDelete.slot.day}</strong> schedule?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSlotToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSlot}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Remove</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetable;
