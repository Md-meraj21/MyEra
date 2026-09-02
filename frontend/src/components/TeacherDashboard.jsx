import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Play,
  Users,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  MapPin,
  AlertCircle,
  LogOut,
  ChevronRight,
  TrendingUp,
  Download,
  Check,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { teacherAPI } from '../services/api';
import Timetable from './Timetable';

const TeacherDashboard = () => {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'timetable' | 'active_session' | 'history'
  const [timetable, setTimetable] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [launchModalSlot, setLaunchModalSlot] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(5); // 5 mins default
  const [customDuration, setCustomDuration] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(200); // 200m default

  const teacherId = user?.id || user?._id;

  // Load teacher initial data (Timetable & Past Sessions)
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

        // Check if there is an active non-expired session
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
        }
      }
    } catch (err) {
      console.error('Error fetching teacher data:', err);
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

    // Fetch initial details
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
    const pollInterval = setInterval(pollDetails, 3000); // refresh attendance every 3s

    // Countdown interval
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          // Auto refresh data when session completes
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

  // Open Launch Modal
  const openLaunchModal = (slot) => {
    setLaunchModalSlot(slot);
    setSelectedDuration(5);
    setCustomDuration('');
    setSelectedRadius(200);
  };

  // Confirm and Start Attendance Session
  const handleConfirmLaunch = async () => {
    if (!launchModalSlot) return;

    const finalDuration = customDuration ? parseInt(customDuration, 10) : selectedDuration;
    if (!finalDuration || finalDuration <= 0) {
      alert('Please enter a valid session duration in minutes.');
      return;
    }

    const slot = launchModalSlot;
    setActionLoading(true);
    setStatusMessage({ type: 'info', text: 'Acquiring teacher classroom location...' });

    const proceedWithLocation = async (lat, lng) => {
      try {
        const res = await teacherAPI.startSession({
          teacherId,
          subject: slot.subject,
          class: slot.class,
          section: slot.section,
          lat,
          lng,
          durationMinutes: finalDuration,
          radius: selectedRadius
        });

        if (res.data.success) {
          setCurrentSession(res.data.session);
          setTimeLeft(finalDuration * 60);
          setLaunchModalSlot(null);
          setActiveTab('active_session');
          setStatusMessage({
            type: 'success',
            text: `Attendance Session started! Code: ${res.data.session.code} (Active for ${finalDuration}m)`
          });
          fetchTeacherData();
        }
      } catch (err) {
        console.error('Failed to start session:', err);
        setStatusMessage({
          type: 'error',
          text: err.response?.data?.message || 'Failed to start attendance session.'
        });
      } finally {
        setActionLoading(false);
      }
    };

    // If Code-Only mode (radius = 0), we don't strictly require hardware GPS
    if (selectedRadius === 0) {
      proceedWithLocation(0, 0);
      return;
    }

    if (!navigator.geolocation) {
      // Fallback for devices without GPS
      proceedWithLocation(0, 0);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        proceedWithLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (geoError) => {
        console.warn('GPS prompt failed or denied, launching with standard fallback coords:', geoError);
        // Fallback: start session so teacher is not blocked by laptop Wi-Fi location error
        proceedWithLocation(28.6139, 77.2090); // default reference coordinates
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Extend Session Time
  const handleExtendSession = async (extraMins) => {
    if (!currentSession) return;
    try {
      setActionLoading(true);
      const res = await teacherAPI.extendSession({
        sessionId: currentSession.id || currentSession._id,
        extraMinutes: extraMins,
        teacherId
      });
      if (res.data.success) {
        const remaining = Math.max(
          0,
          Math.round((new Date(res.data.expiresAt).getTime() - Date.now()) / 1000)
        );
        setTimeLeft(remaining);
        setStatusMessage({ type: 'success', text: `Session extended by ${extraMins} minutes!` });
        // update current session
        setCurrentSession((prev) => ({ ...prev, expiresAt: res.data.expiresAt }));
      }
    } catch (err) {
      console.error('Failed to extend session:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to extend session.' });
    } finally {
      setActionLoading(false);
    }
  };

  // End Session Early
  const handleEndSession = async () => {
    if (!currentSession) return;
    if (!confirm('Are you sure you want to end this attendance session now?')) return;
    try {
      setActionLoading(true);
      const res = await teacherAPI.endSession({
        sessionId: currentSession.id || currentSession._id,
        teacherId
      });
      if (res.data.success) {
        setTimeLeft(0);
        setCurrentSession((prev) => ({ ...prev, status: 'expired' }));
        setStatusMessage({ type: 'info', text: 'Attendance session ended. Data auto-saved to Past Sessions.' });
        fetchTeacherData();
      }
    } catch (err) {
      console.error('Failed to end session:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to end session.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger Excel Download with Axios Blob
  const handleDownloadExcel = async (sessionId) => {
    const targetId = sessionId || currentSession?.id || currentSession?._id || teacherId;
    if (!targetId) return;

    try {
      setActionLoading(true);
      setStatusMessage({ type: 'info', text: 'Preparing Excel report, downloading now...' });
      const res = await teacherAPI.downloadExcel(targetId);

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const subName = currentSession?.subject ? `${currentSession.subject.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
      a.download = `Attendance_${subName}${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setStatusMessage({ type: 'success', text: 'Excel spreadsheet downloaded successfully!' });
    } catch (err) {
      console.error('Blob download failed, trying direct link fallback:', err);
      const url = teacherAPI.getDownloadUrl(targetId);
      window.open(url, '_blank');
      setStatusMessage({ type: 'info', text: 'Excel download started.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const todayDayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  const todaySlots = timetable.filter((t) => t.day.toLowerCase() === todayDayName.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-500/20">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base tracking-tight">MyEra</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-wider border border-emerald-200">
                  Teacher
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">{user?.name} ({user?.subject})</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownloadExcel(null)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              title="Download Master Attendance Spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export All (.xlsx)</span>
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 sm:space-x-8 overflow-x-auto border-t border-slate-100 py-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Dashboard Overview
          </button>
          <button
            onClick={() => setActiveTab('timetable')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'timetable'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Manage Timetable ({timetable.length})
          </button>
          <button
            onClick={() => setActiveTab('active_session')}
            className={`relative px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'active_session'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Live Session</span>
            {currentSession && timeLeft > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Past Sessions & Reports ({sessions.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusMessage.type === 'success' ? (
                <Check className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Today's Lectures</p>
                  <h3 className="text-2xl font-black text-slate-800">{todaySlots.length} Classes</h3>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Weekly Slots</p>
                  <h3 className="text-2xl font-black text-slate-800">{timetable.length} Total</h3>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Sessions Conducted</p>
                  <h3 className="text-2xl font-black text-slate-800">{sessions.length} Recorded</h3>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">GPS Radius</p>
                  <h3 className="text-2xl font-black text-slate-800">30 Meters</h3>
                </div>
              </div>
            </div>

            {/* Active Session Highlight if Running */}
            {currentSession && timeLeft > 0 && (
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-700/20 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                    <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
                    <span>Live Attendance In Progress</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black">
                    {currentSession.subject} ({currentSession.class} - {currentSession.section})
                  </h2>
                  <p className="text-sm text-emerald-100">
                    Students within 30m can submit the 4-digit security code.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-center shadow-lg">
                    <p className="text-[10px] uppercase font-extrabold text-slate-400">Passcode</p>
                    <p className="text-4xl font-black tracking-widest text-emerald-600">
                      {currentSession.code}
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl text-center border border-white/20">
                    <p className="text-[10px] uppercase font-bold text-emerald-200">Expires in</p>
                    <p className="text-3xl font-extrabold text-white font-mono">{formatTime(timeLeft)}</p>
                  </div>

                  <button
                    onClick={() => setActiveTab('active_session')}
                    className="p-3.5 bg-white text-emerald-700 hover:bg-emerald-50 rounded-2xl font-bold text-xs transition shadow-md"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}

            {/* Today's Timetable Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Today's Schedule ({todayDayName})</h3>
                  <p className="text-xs text-slate-500">Click on any period to start instant GPS-verified attendance</p>
                </div>
                <button
                  onClick={() => setActiveTab('timetable')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  View Full Week →
                </button>
              </div>

              {todaySlots.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No classes scheduled for today.</p>
                  <button
                    onClick={() => setActiveTab('timetable')}
                    className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
                  >
                    Add today's slots in Timetable Manager
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todaySlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-emerald-500 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Period {slot.period}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {slot.time}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900">{slot.subject}</h4>
                        <p className="text-xs text-slate-500 mt-1 font-semibold">
                          Class: {slot.class} | Sec: {slot.section}
                        </p>
                      </div>

                      <button
                        onClick={() => openLaunchModal(slot)}
                        disabled={actionLoading}
                        className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Configure & Start Session</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TIMETABLE MANAGER */}
        {activeTab === 'timetable' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Weekly Timetable Schedule</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Organize periods across days. Any slot can be triggered for one-click attendance.
              </p>
            </div>

            <Timetable
              timetable={timetable}
              onSaveTimetable={handleSaveTimetable}
              onStartSession={openLaunchModal}
              isTeacher={true}
            />
          </div>
        )}

        {/* TAB 3: ACTIVE LIVE ATTENDANCE SESSION */}
        {activeTab === 'active_session' && (
          <div className="space-y-6">
            {currentSession ? (
              <div className="space-y-6">
                {/* Active Session Hero */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            timeLeft > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {timeLeft > 0 ? '🟢 Session Active' : '⚪ Session Expired'}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          Started at {new Date(currentSession.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                        {currentSession.subject}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold text-slate-600 mt-2.5">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg">Class: {currentSession.class}</span>
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg">Section: {currentSession.section}</span>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Duration: {currentSession.durationMinutes || 5} mins
                        </span>
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          Geofence: {currentSession.radius === 0 ? 'Code-Only (No GPS)' : `${currentSession.radius || 200}m`}
                        </span>
                      </div>
                    </div>

                    {/* Big Code & Timer Widget + Controls */}
                    <div className="flex flex-wrap items-center gap-4 self-start lg:self-auto">
                      <div className="bg-emerald-50 border-2 border-emerald-200 text-center px-6 py-4 rounded-3xl">
                        <p className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                          4-Digit Code
                        </p>
                        <p className="text-4xl font-black text-emerald-600 tracking-widest mt-0.5">
                          {currentSession.code}
                        </p>
                      </div>

                      <div className="bg-slate-900 text-white text-center px-6 py-4 rounded-3xl shadow-md">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Time Left
                        </p>
                        <p className={`text-3xl font-black font-mono mt-0.5 ${timeLeft <= 30 && timeLeft > 0 ? 'text-amber-400 animate-pulse' : ''}`}>
                          {formatTime(timeLeft)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Session Action Bar */}
                  <div className="pt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 mr-1">Extend Time:</span>
                      <button
                        onClick={() => handleExtendSession(2)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        +2 Mins
                      </button>
                      <button
                        onClick={() => handleExtendSession(5)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        +5 Mins
                      </button>
                      <button
                        onClick={() => handleExtendSession(10)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        +10 Mins
                      </button>
                      {timeLeft > 0 && (
                        <button
                          onClick={handleEndSession}
                          disabled={actionLoading}
                          className="ml-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                        >
                          End Session Early
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span className="hidden sm:inline">Live polling</span>
                      </div>
                      <button
                        onClick={() => handleDownloadExcel(currentSession.id || currentSession._id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20"
                      >
                        <Download className="w-4 h-4" />
                        <span>Excel Sheet</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Session Completed Auto-Action Card */}
                {timeLeft === 0 && (
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in border border-slate-800">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-2xl flex-shrink-0">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white">Attendance Session Completed!</h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {sessionDetails?.presentCount || 0} student(s) marked present. Records auto-saved to database.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => handleDownloadExcel(currentSession.id || currentSession._id)}
                        disabled={actionLoading}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/30 whitespace-nowrap"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Excel (.xlsx)</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('overview')}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/10 whitespace-nowrap"
                      >
                        <span>Start Next Class</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Student Roll List - ONLY Present Students */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-base font-bold text-slate-900">Present Students Roster</h3>
                    </div>
                    <span className="text-xs font-bold px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
                      {sessionDetails?.presentCount || 0} Students Present
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="py-3.5 px-6">Roll No</th>
                          <th className="py-3.5 px-6">Student Name</th>
                          <th className="py-3.5 px-6">Class / Sec</th>
                          <th className="py-3.5 px-6">Check-in Time</th>
                          <th className="py-3.5 px-6 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sessionDetails?.attendanceList && sessionDetails.attendanceList.filter((st) => st.status === 'present' && st.markedAt).length > 0 ? (
                          sessionDetails.attendanceList
                            .filter((st) => st.status === 'present' && st.markedAt)
                            .map((st, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-6 font-mono font-bold text-slate-800">
                                {st.rollNumber}
                              </td>
                              <td className="py-3.5 px-6 font-semibold text-slate-900">
                                {st.name}
                              </td>
                              <td className="py-3.5 px-6 text-xs text-slate-500 font-medium">
                                {st.class} - {st.section}
                              </td>
                              <td className="py-3.5 px-6 text-xs text-slate-500 font-mono">
                                {new Date(st.markedAt).toLocaleTimeString()}
                              </td>
                              <td className="py-3.5 px-6 text-right">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Present
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-14 text-center">
                              <div className="max-w-xs mx-auto text-center space-y-2">
                                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto animate-pulse">
                                  <Users className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-bold text-slate-700">Waiting for student submissions...</p>
                                <p className="text-[11px] text-slate-400">
                                  Students will enter code <strong>{currentSession.code}</strong> to appear here in real time.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto">
                <Radio className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Active Attendance Session</h3>
                <p className="text-xs text-slate-500 mt-1 mb-5">
                  Pick a period from your weekly timetable or overview to launch a GPS verified check-in.
                </p>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20"
                >
                  Go to Today's Schedule
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PAST SESSIONS & EXCEL REPORTS */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Past Attendance Sessions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit logs and download Excel (.xlsx) spreadsheets for any conducted lecture.
                </p>
              </div>

              <button
                onClick={() => handleDownloadExcel(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export Master Report (.xlsx)</span>
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No past sessions recorded yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Once you start and complete a session, history and Excel files will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-4 px-6">Date & Time</th>
                        <th className="py-4 px-6">Subject</th>
                        <th className="py-4 px-6">Class / Sec</th>
                        <th className="py-4 px-6">Session Code</th>
                        <th className="py-4 px-6">Attendance</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessions.map((sess, idx) => {
                        const present = sess.students ? sess.students.filter((s) => s.status === 'present').length : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-4 px-6 font-semibold text-slate-800 text-xs">
                              {new Date(sess.createdAt).toLocaleDateString()} at{' '}
                              {new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-4 px-6 font-bold text-slate-900">
                              {sess.subject}
                            </td>
                            <td className="py-4 px-6 text-xs text-slate-600 font-semibold">
                              {sess.class} - {sess.section}
                            </td>
                            <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                              {sess.code}
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Users className="w-3.5 h-3.5" />
                                {present} Students Present
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right space-x-2">
                              <button
                                onClick={() => handleDownloadExcel(sess._id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition border border-emerald-200"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Excel</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* LAUNCH SESSION CONFIGURATION MODAL */}
      {launchModalSlot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
              <div className="flex items-center justify-between mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold text-[10px] uppercase tracking-wider">
                  Session Setup
                </span>
                <button
                  onClick={() => setLaunchModalSlot(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <h3 className="text-xl font-black">{launchModalSlot.subject}</h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Class: {launchModalSlot.class} | Section: {launchModalSlot.section}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Duration Setting */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                  1. Session Active Duration
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2.5">
                  {[2, 5, 10, 15].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => { setSelectedDuration(mins); setCustomDuration(''); }}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        selectedDuration === mins && !customDuration
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mins} Mins
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => { setSelectedDuration(mins); setCustomDuration(''); }}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        selectedDuration === mins && !customDuration
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mins} Mins
                    </button>
                  ))}
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Custom"
                      min="1"
                      max="180"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      className={`w-full py-2 px-2 text-center rounded-xl text-xs font-bold border outline-none ${
                        customDuration
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Geofence Tolerance Setting */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                  2. GPS Geofence Range (Fixes Laptop / Phone distance)
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRadius(200)}
                    className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      selectedRadius === 200
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">200m - Room / Campus (Recommended)</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-600 text-white">Default</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Best when teacher is on Laptop Wi-Fi and students on Phone.</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedRadius === 200 ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                      {selectedRadius === 200 && <span className="text-[10px]">✓</span>}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRadius(50)}
                    className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      selectedRadius === 50
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900">50m - Strict Classroom Only</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">High precision presence inside the exact room.</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedRadius === 50 ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                      {selectedRadius === 50 && <span className="text-[10px]">✓</span>}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRadius(0)}
                    className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      selectedRadius === 0
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900">Code-Only Mode (No GPS Location Check)</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">100% bypass of GPS — students only need the 4-digit code.</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedRadius === 0 ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                      {selectedRadius === 0 && <span className="text-[10px]">✓</span>}
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLaunchModalSlot(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLaunch}
                disabled={actionLoading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/25 flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch Live Session ({customDuration ? `${customDuration}m` : `${selectedDuration}m`})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
