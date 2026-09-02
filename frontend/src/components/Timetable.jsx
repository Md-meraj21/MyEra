import React, { useState } from 'react';
import { Calendar, Clock, Plus, Play, BookOpen, Trash2, Check, Sparkles } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SAMPLE_TIMETABLE = [
  { day: 'Monday', period: 1, subject: 'Computer Science', class: 'CS-4A', section: 'A', time: '09:00 AM - 10:00 AM' },
  { day: 'Monday', period: 2, subject: 'Data Structures', class: 'CS-4A', section: 'A', time: '10:00 AM - 11:00 AM' },
  { day: 'Tuesday', period: 1, subject: 'Operating Systems', class: 'CS-4B', section: 'B', time: '09:00 AM - 10:00 AM' },
  { day: 'Wednesday', period: 3, subject: 'Database Management', class: 'CS-4A', section: 'A', time: '11:15 AM - 12:15 PM' },
  { day: 'Thursday', period: 2, subject: 'Computer Networks', class: 'CS-4A', section: 'A', time: '10:00 AM - 11:00 AM' },
  { day: 'Friday', period: 4, subject: 'Software Engineering', class: 'CS-4C', section: 'C', time: '01:30 PM - 02:30 PM' },
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
    class: '',
    section: 'A',
    time: '09:00 AM - 10:00 AM'
  });

  const activeDayList = (timetable.length > 0 ? timetable : []).filter(
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
      await onSaveTimetable(updatedList);
      setShowAddModal(false);
      setFormData({
        day: selectedDay,
        period: (activeDayList.length + 1) || 1,
        subject: '',
        class: '',
        section: 'A',
        time: '09:00 AM - 10:00 AM'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (indexToDelete) => {
    if (!confirm('Are you sure you want to remove this timetable slot?')) return;
    const updatedList = timetable.filter((_, idx) => idx !== indexToDelete);
    await onSaveTimetable(updatedList);
  };

  const handleLoadSampleTimetable = async () => {
    if (timetable.length > 0 && !confirm('Replace current timetable with sample slots?')) return;
    await onSaveTimetable(DEFAULT_SAMPLE_TIMETABLE);
  };

  return (
    <div className="space-y-6">
      {/* Day Selector & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Day Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {DAYS.map((day) => {
            const isToday = day.toLowerCase() === currentDayName.toLowerCase();
            const isSelected = day === selectedDay;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`relative px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{day.slice(0, 3)}</span>
                {isToday && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] rounded-full bg-emerald-500 text-white">
                    Today
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Teacher Controls */}
        {isTeacher && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {timetable.length === 0 && (
              <button
                type="button"
                onClick={handleLoadSampleTimetable}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Load Sample
              </button>
            )}
            <button
              onClick={() => {
                setFormData((prev) => ({ ...prev, day: selectedDay }));
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              Add Period
            </button>
          </div>
        )}
      </div>

      {/* Timetable Grid for Selected Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeDayList.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No periods scheduled for {selectedDay}</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {isTeacher
                ? 'Click "Add Period" above to create slots for this day.'
                : 'Your teacher has not listed any lecture periods for this day yet.'}
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
                className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Period {slot.period}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {slot.time}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {slot.subject}
                  </h4>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-2">
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md">Class: {slot.class}</span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md">Section: {slot.section}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isTeacher ? (
                    <>
                      <button
                        onClick={() => onStartSession(slot)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-emerald-600/20 active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Start Attendance
                      </button>

                      <button
                        onClick={() => handleDeleteEntry(rawIndex)}
                        title="Delete slot"
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full text-center py-1 text-xs text-slate-500 font-medium">
                      Waiting for teacher to start session
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Period Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Add Timetable Slot</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Day
                </label>
                <select
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Period No.
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Time Slot
                  </label>
                  <input
                    type="text"
                    placeholder="09:00 AM - 10:00 AM"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Subject Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures & Algorithms"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Class
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS-4A"
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Period'}
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
