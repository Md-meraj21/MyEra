import React, { useState } from 'react';
import { Calendar, Clock, Plus, Play, Trash2, CheckCircle2 } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SAMPLE_TIMETABLE = [
  { day: 'Monday', period: 1, subject: 'Data Structures & Algorithms', class: 'CS-4A', section: 'A', time: '09:00 AM - 10:00 AM' },
  { day: 'Monday', period: 2, subject: 'Operating Systems', class: 'CS-4A', section: 'A', time: '10:00 AM - 11:00 AM' },
  { day: 'Tuesday', period: 1, subject: 'Database Management Systems', class: 'CS-4A', section: 'A', time: '09:00 AM - 10:00 AM' },
  { day: 'Wednesday', period: 3, subject: 'Computer Networks', class: 'CS-4A', section: 'A', time: '11:15 AM - 12:15 PM' },
  { day: 'Thursday', period: 2, subject: 'Software Engineering', class: 'CS-4A', section: 'A', time: '10:00 AM - 11:00 AM' },
  { day: 'Friday', period: 4, subject: 'Discrete Mathematics', class: 'CS-4A', section: 'A', time: '01:30 PM - 02:30 PM' },
];

const Timetable = ({ timetable = [], onSaveTimetable, onStartSession, isTeacher = false }) => {
  const currentDayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  const [selectedDay, setSelectedDay] = useState(DAYS.includes(currentDayName) ? currentDayName : 'Monday');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.class || !formData.section) {
      alert('Please fill out all required fields.');
      return;
    }

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

  const handleDeleteEntry = async (indexToDelete) => {
    if (!confirm('Are you sure you want to remove this timetable period?')) return;
    const updatedList = timetable.filter((_, idx) => idx !== indexToDelete);
    if (onSaveTimetable) {
      await onSaveTimetable(updatedList);
    }
  };

  const handleLoadSampleTimetable = async () => {
    if (timetable.length > 0 && !confirm('Load standard sample schedule for all subjects?')) return;
    if (onSaveTimetable) {
      await onSaveTimetable(DEFAULT_SAMPLE_TIMETABLE);
    }
  };

  return (
    <div className="space-y-4">
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
                onClick={handleLoadSampleTimetable}
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

                      {rawIndex !== -1 && (
                        <button
                          onClick={() => handleDeleteEntry(rawIndex)}
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
    </div>
  );
};

export default Timetable;
