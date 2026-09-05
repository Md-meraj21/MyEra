import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  Play,
  CheckCircle2,
  FileSpreadsheet,
  LogOut,
  Download,
  Check,
  Radio,
  Calendar,
  Layers,
  History,
  AlertCircle,
  MapPin,
  RefreshCw,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { teacherAPI } from '../services/api';
import Timetable from './Timetable';

const TeacherDashboard = () => {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'timetable' | 'history'
  const [timetable, setTimetable] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [customSubject, setCustomSubject] = useState('');
  const [customClass, setCustomClass] = useState('CS-4A');
  const [customSection, setCustomSection] = useState('A');
  const [selectedDuration, setSelectedDuration] = useState(5);
  const [selectedRadius, setSelectedRadius] = useState(200);

  const teacherId = user?.id || user?._id;

  // Load teacher initial data
  const fetchTeacherData = async () => {
    if (!teacherId) return;
    try {
      setLoading(true);
      const [ttRes, sessRes] = await Promise.allSettled([
        teacherAPI.getTimetable(teacherId),
        teacherAPI.getSessions(teacherId)
      ]);

      if (ttRes.status === 'fulfilled' && ttRes.value.data.success) {
        setTimetable(ttRes.value.data.timetable || []);
      }

      if (sessRes.status === 'fulfilled' && sessRes.value.data.success) {
        const sessList = sessRes.value.data.sessions || [];
        setSessions(sessList);

        // Check if there is an active session
        const activeOne = sessList.find(
          (s) => s.status === 'active' && new Date(s.expiresAt) > new Date()
        );
        if (activeOne) {
          setCurrentSession(activeOne);
          const remainingSecs = Math.max(
            0,
            Math.round((new Date(activeOne.expiresAt).getTime() - Date.now()) / 1000)
          );
          setTimeLeft(remainingSecs);
        } else {
          setCurrentSession(null);
        }
      }
    } catch (err) {
      console.error('Error loading teacher data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, [teacherId]);

  // Polling for live session details and countdown
  useEffect(() => {
    if (!currentSession) return;

    const pollDetails = async () => {
      try {
        const res = await teacherAPI.getSessionDetails(currentSession.id || currentSession._id);
        if (res.data.success) {
          setSessionDetails(res.data.session);
          if (res.data.session.status === 'expired') {
            setTimeLeft(0);
          } else {
            const rem = Math.max(
              0,
              Math.round((new Date(res.data.session.expiresAt).getTime() - Date.now()) / 1000)
            );
            setTimeLeft(rem);
          }
        }
      } catch (err) {
        console.error('Error polling session:', err);
      }
    };

    pollDetails();
    const pollInterval = setInterval(pollDetails, 3000);

    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          fetchTeacherData();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [currentSession]);

  // Handle Save Timetable
  const handleSaveTimetable = async (updatedTimetable) => {
    try {
      setActionLoading(true);
      const res = await teacherAPI.addTimetable({
        teacherId,
        timetable: updatedTimetable
      });
      if (res.data.success) {
        setTimetable(res.data.timetable);
        setStatusMessage({ type: 'success', text: 'Timetable updated successfully!' });
      }
    } catch (err) {
      console.error('Failed to update timetable:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update timetable.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Launch modal for a slot or custom session
  const openLaunchModalForSlot = (slot) => {
    setSelectedSlot(slot);
    setCustomSubject(slot.subject);
    setCustomClass(slot.class);
    setCustomSection(slot.section);
    setSelectedDuration(5);
    setSelectedRadius(200);
    setShowLaunchModal(true);
  };

  const openCustomLaunchModal = () => {
    setSelectedSlot(null);
    setCustomSubject(user?.subject || 'Data Structures & Algorithms');
    setCustomClass('CS-4A');
    setCustomSection('A');
    setSelectedDuration(5);
    setSelectedRadius(200);
    setShowLaunchModal(true);
  };

  // Start Session with GPS
  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!customSubject || !customClass || !customSection) {
      setStatusMessage({ type: 'error', text: 'Please enter subject, class, and section.' });
      return;
    }

    if (!navigator.geolocation) {
      setStatusMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      return;
    }

    setActionLoading(true);
    setStatusMessage({ type: 'info', text: 'Acquiring teacher GPS coordinates...' });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await teacherAPI.startSession({
            teacherId,
            subject: customSubject.trim(),
            class: customClass.trim(),
            section: customSection.trim(),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            durationMinutes: selectedDuration,
            radius: selectedRadius
          });

          if (res.data.success) {
            setCurrentSession(res.data.session);
            setTimeLeft(res.data.session.durationSeconds || selectedDuration * 60);
            setShowLaunchModal(false);
            setActiveTab('overview');
            setStatusMessage({
              type: 'success',
              text: `Attendance Session Active! 4-Digit Code: ${res.data.session.code}`
            });
            fetchTeacherData();
          }
        } catch (err) {
          console.error('Error starting session:', err);
          setStatusMessage({
            type: 'error',
            text: err.response?.data?.message || 'Failed to start session.'
          });
        } finally {
          setActionLoading(false);
        }
      },
      (geoError) => {
        console.warn('GPS error, using fallback coordinates:', geoError);
        // Fallback for laptops/desktop browser
        teacherAPI.startSession({
          teacherId,
          subject: customSubject.trim(),
          class: customClass.trim(),
          section: customSection.trim(),
          lat: 28.6139,
          lng: 77.2090,
          durationMinutes: selectedDuration,
          radius: selectedRadius
        }).then((res) => {
          if (res.data.success) {
            setCurrentSession(res.data.session);
            setTimeLeft(res.data.session.durationSeconds || selectedDuration * 60);
            setShowLaunchModal(false);
            setActiveTab('overview');
            setStatusMessage({
              type: 'success',
              text: `Attendance Session Started! Code: ${res.data.session.code}`
            });
            fetchTeacherData();
          }
        }).catch((err) => {
          setStatusMessage({
            type: 'error',
            text: err.response?.data?.message || 'Failed to start session.'
          });
        }).finally(() => {
          setActionLoading(false);
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // End Session
  const handleEndSession = async () => {
    if (!currentSession) return;
    try {
      setActionLoading(true);
      const res = await teacherAPI.endSession({
        sessionId: currentSession.id || currentSession._id,
        teacherId
      });
      if (res.data.success) {
        setCurrentSession(null);
        setSessionDetails(null);
        setTimeLeft(0);
        setStatusMessage({ type: 'success', text: 'Attendance session concluded.' });
        fetchTeacherData();
      }
    } catch (err) {
      console.error('Failed to end session:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Download Excel
  const handleDownload = async (targetId, filename = 'attendance.xlsx') => {
    try {
      const res = await teacherAPI.downloadExcel(targetId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to download attendance spreadsheet.' });
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen pb-mobile-nav selection:bg-blue-200">
      {/* Top Header */}
      <header className="glass-header sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
                  Teacher
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[180px] sm:max-w-none">
                {user?.name || 'Professor'} • {user?.subject || 'Faculty'}
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

        {/* Desktop Tab Bar */}
        <div className="hidden md:flex max-w-5xl mx-auto px-4 sm:px-6 space-x-2 border-t border-blue-100/60 py-2">
          {[
            { id: 'overview', label: 'Live Dashboard', icon: Radio },
            { id: 'timetable', label: 'Class Schedule', icon: Calendar },
            { id: 'history', label: `Past Sessions (${sessions.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'btn-bright-blue text-white shadow-sm'
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6">
        {/* Status Message */}
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
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
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

        {/* TAB 1: OVERVIEW & ACTIVE SESSION */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Active Live Session Display */}
            {currentSession && timeLeft > 0 ? (
              <div className="card-human rounded-3xl p-5 sm:p-7 border-2 border-blue-400 bg-white shadow-xl shadow-blue-500/10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>Live Session Active</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      {currentSession.subject}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Class: {currentSession.class}-{currentSession.section}
                    </p>
                  </div>

                  {/* Countdown Timer */}
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Time Remaining
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-blue-600 font-mono">
                      {formatTimer(timeLeft)}
                    </span>
                  </div>
                </div>

                {/* 4-Digit Passcode Presentation */}
                <div className="p-6 bg-gradient-to-br from-blue-50 to-sky-50 rounded-3xl border border-blue-200 text-center space-y-2">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                    Student Passcode
                  </span>
                  <div className="text-4xl sm:text-6xl font-black text-slate-900 font-mono tracking-[0.4em] pl-4">
                    {currentSession.code}
                  </div>
                  <p className="text-xs text-slate-500">
                    Students must enter this code within the classroom to mark presence.
                  </p>
                </div>

                {/* Live Attendees Counter & Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-bold text-slate-800">
                      {sessionDetails?.presentCount || currentSession.students?.length || 0} Students Marked Present
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleEndSession}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition border border-rose-200"
                    >
                      End Session Now
                    </button>
                    <button
                      onClick={() => handleDownload(currentSession.id || currentSession._id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold btn-bright-blue transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Excel</span>
                    </button>
                  </div>
                </div>

                {/* Attendees List */}
                {sessionDetails?.attendanceList && sessionDetails.attendanceList.length > 0 && (
                  <div className="pt-4 border-t border-blue-50">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Live Check-in List
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {sessionDetails.attendanceList.map((st, i) => (
                        <div key={i} className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{st.name}</span>
                            <span className="text-slate-400 ml-1.5 font-mono">({st.rollNumber})</span>
                          </div>
                          <span className="text-emerald-700 font-bold text-[11px] bg-emerald-100 px-2 py-0.5 rounded-md">
                            {new Date(st.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* No Active Session - Quick Launch CTA */
              <div className="card-human rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">

                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                      Start Classroom Session
                    </h2>
                    <p className="text-xs text-slate-500">
                      Launch a dynamic attendance passcode with GPS presence verification.
                    </p>
                  </div>

                  <button
                    onClick={openCustomLaunchModal}
                    className="px-5 py-3 btn-bright-blue rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 shadow-md whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Launch New Session</span>
                  </button>
                </div>

                {/* Quick Schedule Row */}
                <div className="pt-4 border-t border-blue-50">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Scheduled Lectures for Today
                  </h3>
                  <Timetable
                    timetable={timetable}
                    onSaveTimetable={handleSaveTimetable}
                    onStartSession={openLaunchModalForSlot}
                    isTeacher={true}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TIMETABLE */}
        {activeTab === 'timetable' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Class Schedule & Subjects
                </h2>
                <p className="text-xs text-slate-500">
                  Manage weekly lecture periods across all enrolled courses.
                </p>
              </div>
            </div>
            <Timetable
              timetable={timetable}
              onSaveTimetable={handleSaveTimetable}
              onStartSession={openLaunchModalForSlot}
              isTeacher={true}
            />
          </div>
        )}

        {/* TAB 3: PAST SESSIONS & EXCEL DOWNLOAD */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Attendance Archives
                </h2>
                <p className="text-xs text-slate-500">
                  Download spreadsheet reports or inspect attendee records.
                </p>
              </div>

              {sessions.length > 0 && (
                <button
                  onClick={() => handleDownload(teacherId, `All_Lectures_${user?.name || 'Report'}.xlsx`)}
                  className="px-3.5 py-2 btn-bright-blue rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download All Lectures (.xlsx)</span>
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="card-human rounded-3xl p-8 text-center space-y-2">
                <History className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No past sessions recorded yet.</p>
                <p className="text-xs text-slate-400">
                  Once you start and complete a lecture session, it will be listed here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((sess, idx) => (
                  <div
                    key={idx}
                    className="card-human rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">
                          {sess.subject}
                        </h4>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md">
                          {sess.class}-{sess.section}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(sess.createdAt).toLocaleDateString()} • {new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Code: <strong className="font-mono text-blue-600">{sess.code}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className="text-xs font-bold text-slate-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {sess.students?.length || 0} Present
                      </span>
                      <button
                        onClick={() => handleDownload(sess._id || sess.id, `Attendance_${sess.subject}_${sess.class}.xlsx`)}
                        className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 border border-blue-200 transition"
                        title="Download Excel Spreadsheet"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Launch Session Modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="card-human rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Launch Attendance Session</h3>
              </div>
              <button
                onClick={() => setShowLaunchModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartSession} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class</label>
                  <input
                    type="text"
                    value={customClass}
                    onChange={(e) => setCustomClass(e.target.value)}
                    placeholder="CS-4A"
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={customSection}
                    onChange={(e) => setCustomSection(e.target.value)}
                    placeholder="A"
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration</label>
                  <select
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={2}>2 Minutes (Standard)</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GPS Radius</label>
                  <select
                    value={selectedRadius}
                    onChange={(e) => setSelectedRadius(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={50}>50 Meters (Strict)</option>
                    <option value={200}>200 Meters (Recommended)</option>
                    <option value={500}>500 Meters (Wide Campus)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-800 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-600 leading-snug">
                  GPS location will be automatically tagged to enforce classroom proximity.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-blue-50">
                <button
                  type="button"
                  onClick={() => setShowLaunchModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold btn-bright-blue transition disabled:opacity-50"
                >
                  {actionLoading ? 'Launching...' : 'Start Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-bottom-nav z-40 px-2 py-1.5">
        <div className="flex items-center justify-around">
          {[
            { id: 'overview', label: 'Live', icon: Radio },
            { id: 'timetable', label: 'Schedule', icon: Calendar },
            { id: 'history', label: 'Reports', icon: History },
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

export default TeacherDashboard;
