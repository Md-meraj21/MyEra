import React, { useState, useEffect } from 'react';
import {
  Home,
  KeyRound,
  BookOpen,
  Calendar,
  History,
  LogOut,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Filter,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { studentAPI, teacherAPI } from '../services/api';
import AttendanceStrip from './AttendanceStrip';
import Timetable from './Timetable';

const StudentDashboard = () => {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'mark' | 'subjects' | 'timetable' | 'history'
  const [code, setCode] = useState('');
  const [stripData, setStripData] = useState({ overall: null, subjectStrips: [] });
  const [history, setHistory] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const studentId = user?.id || user?._id;

  // Fetch Student Strip, History & Timetable
  const fetchStudentData = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      const [stripRes, histRes] = await Promise.allSettled([
        studentAPI.getAttendanceStrip(studentId),
        studentAPI.getAttendanceHistory(studentId)
      ]);

      if (stripRes.status === 'fulfilled' && stripRes.value.data.success) {
        setStripData({
          overall: stripRes.value.data.overall,
          subjectStrips: stripRes.value.data.subjectStrips || []
        });
      }

      if (histRes.status === 'fulfilled' && histRes.value.data.success) {
        setHistory(histRes.value.data.history || []);
      }
    } catch (err) {
      console.error('Error loading student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [studentId]);

  // Handle Mark Attendance with GPS Check
  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    if (!code || code.trim().length !== 4) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter a valid 4-digit session passcode.'
      });
      return;
    }

    if (!navigator.geolocation) {
      setStatusMessage({
        type: 'error',
        text: 'Location service is not supported by your browser. Please use a device with GPS.'
      });
      return;
    }

    setSubmitting(true);
    setStatusMessage({
      type: 'info',
      text: 'Verifying GPS location for classroom check-in...'
    });

    const submitWithCoords = async (lat, lng) => {
      try {
        const res = await studentAPI.markAttendance({
          studentId,
          code: code.trim(),
          lat,
          lng
        });

        if (res.data.success) {
          try {
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (e) {
            // ignore
          }

          const distText = res.data.data.distanceMeters !== undefined ? ` (${res.data.data.distanceMeters}m away)` : '';
          setStatusMessage({
            type: 'success',
            text: `Attendance marked successfully for ${res.data.data.subject}!${distText}`
          });
          setCode('');
          fetchStudentData();
        }
      } catch (err) {
        console.error('Failed to mark attendance:', err);
        const errorMsg = err.response?.data?.message || 'Verification failed. Please check the code and ensure you are in class.';
        setStatusMessage({
          type: 'error',
          text: errorMsg
        });
      } finally {
        setSubmitting(false);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        submitWithCoords(position.coords.latitude, position.coords.longitude);
      },
      (geoError) => {
        console.warn('High-accuracy GPS failed, trying standard fallback:', geoError);
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            submitWithCoords(fallbackPos.coords.latitude, fallbackPos.coords.longitude);
          },
          (finalError) => {
            setSubmitting(false);
            let errorHint = 'Unable to access your GPS location. Please turn on Location in phone settings and grant browser permission.';
            if (finalError.code === 1) {
              errorHint = 'Location permission denied. Click the lock icon in your address bar and allow Location.';
            } else if (finalError.code === 2) {
              errorHint = 'Device GPS is turned off. Please enable Location / GPS in your device settings.';
            }
            setStatusMessage({
              type: 'error',
              text: errorHint
            });
          },
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Filtered History
  const filteredHistory = selectedSubjectFilter === 'all'
    ? history
    : history.filter(h => h.subject.toLowerCase() === selectedSubjectFilter.toLowerCase());

  // Distinct subjects in history & strips
  const allSubjectNames = Array.from(new Set([
    ...stripData.subjectStrips.map(s => s.subject),
    ...history.map(h => h.subject)
  ]));

  return (
    <div className="min-h-screen pb-mobile-nav selection:bg-blue-200">
      {/* Top Header */}
      <header className="glass-header sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl btn-bright-blue flex items-center justify-center font-black text-xl shadow-md">
              M
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                  MyEra
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] border border-blue-200">
                  Student
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[180px] sm:max-w-none">
                {user?.name || 'Student'} • {user?.class}-{user?.section}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Desktop Tab Bar (Hidden on small mobile) */}
        <div className="hidden md:flex max-w-4xl mx-auto px-4 sm:px-6 space-x-2 border-t border-blue-100/60 py-2">
          {[
            { id: 'overview', label: 'Overview', icon: Home },
            { id: 'mark', label: 'Mark Attendance', icon: KeyRound },
            { id: 'subjects', label: `My Subjects (${stripData.subjectStrips.length})`, icon: BookOpen },
            { id: 'timetable', label: 'Class Schedule', icon: Calendar },
            { id: 'history', label: `History (${history.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6">
        {/* Status Message Notification */}
        {statusMessage && (
          <div
            className={`mb-5 p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              ) : (
                <MapPin className="w-4 h-4 text-blue-600 animate-pulse flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-60 hover:opacity-100 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Quick Check-In CTA Card */}
            <div className="card-human rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/20 rounded-full text-[11px] font-bold">
                  <MapPin className="w-3 h-3 text-blue-200" />
                  <span>GPS Presence Check Active</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black">
                  Ready for today's lecture?
                </h2>
                <p className="text-xs text-blue-100 max-w-sm">
                  Enter the 4-digit code shown by your teacher to record attendance.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('mark')}
                className="w-full sm:w-auto px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 rounded-2xl font-bold text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
              >
                <KeyRound className="w-4 h-4" />
                <span>Enter Passcode</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Attendance Progress & Strips */}
            <AttendanceStrip
              overall={stripData.overall}
              subjectStrips={stripData.subjectStrips}
              onSelectSubject={(subj) => {
                setSelectedSubjectFilter(subj);
                setActiveTab('history');
              }}
            />
          </div>
        )}

        {/* TAB 2: MARK ATTENDANCE */}
        {activeTab === 'mark' && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="card-human rounded-3xl p-6 sm:p-8 text-center space-y-5">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Enter 4-Digit Passcode
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Type the code displayed on your teacher's screen.
                </p>
              </div>

              <form onSubmit={handleMarkAttendance} className="space-y-4">
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="• • • •"
                    className="w-full text-center text-3xl sm:text-4xl font-black tracking-[0.5em] py-3.5 rounded-2xl border-2 border-blue-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition font-mono bg-blue-50/30"
                    autoFocus
                    required
                  />
                </div>

                <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 text-left flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-slate-600">
                    <p className="font-bold text-slate-800">Classroom GPS Verification</p>
                    <p className="mt-0.5 text-slate-500">
                      Ensures your physical presence in the lecture hall.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || code.length !== 4}
                  className="w-full py-3.5 px-6 rounded-2xl btn-bright-blue font-bold text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Check In</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: MY SUBJECTS (MULTI-SUBJECT PORTFOLIO) */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  My Semester Subjects
                </h2>
                <p className="text-xs text-slate-500">
                  Track and monitor attendance percentage for each enrolled course.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                {stripData.subjectStrips.length} Courses
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {stripData.subjectStrips.map((item, idx) => (
                <div
                  key={idx}
                  className="card-human rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-blue-500/20">
                        {item.subject.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 leading-tight">
                          {item.subject}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Class: {user?.class}-{user?.section}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-black ${
                      item.percentage >= 75 ? 'text-emerald-600' : item.percentage >= 50 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {item.percentage}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-2 border-t border-blue-50">
                    <div className="bg-blue-50/60 p-1.5 rounded-lg">
                      <span className="text-slate-400 block">Total</span>
                      <strong className="text-slate-700">{item.totalClasses}</strong>
                    </div>
                    <div className="bg-emerald-50/70 p-1.5 rounded-lg">
                      <span className="text-emerald-600 block">Present</span>
                      <strong className="text-emerald-700">{item.presentClasses}</strong>
                    </div>
                    <div className="bg-rose-50/70 p-1.5 rounded-lg">
                      <span className="text-rose-600 block">Absent</span>
                      <strong className="text-rose-700">{item.absentClasses}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedSubjectFilter(item.subject);
                      setActiveTab('history');
                    }}
                    className="w-full py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition flex items-center justify-center gap-1 border border-blue-100"
                  >
                    <span>View Attendance Log</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TIMETABLE SCHEDULE */}
        {activeTab === 'timetable' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Weekly Class Schedule
              </h2>
              <p className="text-xs text-slate-500">
                View your lectures and scheduled periods for all subjects.
              </p>
            </div>
            <Timetable isTeacher={false} />
          </div>
        )}

        {/* TAB 5: ATTENDANCE HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Attendance History
                </h2>
                <p className="text-xs text-slate-500">
                  Detailed timestamp log of every verified check-in.
                </p>
              </div>

              {/* Subject Filter Dropdown */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-200 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Subjects ({history.length})</option>
                  {allSubjectNames.map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="card-human rounded-3xl p-8 text-center space-y-2">
                <History className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No attendance logs found.</p>
                <p className="text-xs text-slate-400">
                  Check-ins will appear here once you attend sessions.
                </p>
              </div>
            ) : (
              <div className="card-human rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-blue-50/80 text-[11px] font-bold text-blue-900/70 uppercase tracking-wider border-b border-blue-100">
                        <th className="py-3 px-4 sm:px-6">Subject</th>
                        <th className="py-3 px-4 sm:px-6">Date</th>
                        <th className="py-3 px-4 sm:px-6">Time</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {filteredHistory.map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-800">
                            {item.subject}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-slate-600 text-xs">
                            {new Date(item.date).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-slate-500 font-mono text-xs">
                            {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Check className="w-3 h-3" />
                              <span>Present</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Visible on Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-bottom-nav z-40 px-2 py-1.5">
        <div className="flex items-center justify-around">
          {[
            { id: 'overview', label: 'Home', icon: Home },
            { id: 'mark', label: 'Check-In', icon: KeyRound },
            { id: 'subjects', label: 'Subjects', icon: BookOpen },
            { id: 'timetable', label: 'Schedule', icon: Calendar },
            { id: 'history', label: 'History', icon: History },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition ${
                  isActive
                    ? 'text-blue-600 font-extrabold'
                    : 'text-slate-400 hover:text-slate-600 font-semibold'
                }`}
              >
                <div className={`p-1 rounded-xl transition ${isActive ? 'bg-blue-100' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default StudentDashboard;
