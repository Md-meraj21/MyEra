import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
  LogOut,
  Calendar,
  History,
  KeyRound,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { studentAPI } from '../services/api';
import AttendanceStrip from './AttendanceStrip';

const StudentDashboard = () => {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'mark' | 'history'
  const [code, setCode] = useState('');
  const [stripData, setStripData] = useState({ overall: null, subjectStrips: [] });
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'acquiring' | 'ready' | 'error'

  const studentId = user?.id || user?._id;

  // Fetch Student Strip & History
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
        text: 'Please enter a valid 4-digit session code.'
      });
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setStatusMessage({
        type: 'error',
        text: 'GPS Location requires HTTPS. Please open this app using the live HTTPS link.'
      });
      return;
    }

    if (!navigator.geolocation) {
      setStatusMessage({
        type: 'error',
        text: 'Geolocation is not supported by your browser. Please enable GPS on your device.'
      });
      return;
    }

    setSubmitting(true);
    setGpsStatus('acquiring');
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
          // Trigger celebration confetti
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (e) {
            // ignore
          }

          const distText = res.data.data.distanceMeters !== undefined ? ` (Distance: ${res.data.data.distanceMeters}m)` : '';
          setStatusMessage({
            type: 'success',
            text: `Attendance marked successfully for ${res.data.data.subject}!${distText}`
          });
          setCode('');
          setGpsStatus('ready');
          fetchStudentData();
        }
      } catch (err) {
        console.error('Failed to mark attendance:', err);
        const errorMsg = err.response?.data?.message || 'Failed to mark attendance. Check code and location.';
        setStatusMessage({
          type: 'error',
          text: errorMsg
        });
        setGpsStatus('error');
      } finally {
        setSubmitting(false);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        submitWithCoords(position.coords.latitude, position.coords.longitude);
      },
      (geoError) => {
        console.warn('High accuracy GPS error, trying with standard accuracy:', geoError);
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            submitWithCoords(fallbackPos.coords.latitude, fallbackPos.coords.longitude);
          },
          (finalError) => {
            setSubmitting(false);
            setGpsStatus('error');
            let errorHint = 'Unable to get your location. Please enable GPS in your phone settings and reload.';
            if (finalError.code === 1) {
              errorHint = 'Location permission denied. Click the 🔒 icon in your browser address bar and choose "Allow Location".';
            } else if (finalError.code === 2) {
              errorHint = 'Device GPS is turned OFF. Please swipe down and turn ON your phone Location / GPS toggle.';
            } else if (finalError.code === 3) {
              errorHint = 'GPS request timed out. Please stand near a window or check phone location settings.';
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

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-500/20">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base tracking-tight">MyEra</span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase tracking-wider border border-indigo-200">
                  Student
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {user?.name} (Roll: {user?.rollNumber} | Class: {user?.class}-{user?.section})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            My Progress & Strips
          </button>
          <button
            onClick={() => setActiveTab('mark')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'mark'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Mark Attendance (GPS)</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Attendance History ({history.length})
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
              ) : (
                <MapPin className="w-5 h-5 text-indigo-600 animate-bounce flex-shrink-0" />
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

        {/* TAB 1: OVERVIEW & ATTENDANCE STRIPS */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Check-in Banner Card */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-600/20 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                  <MapPin className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Haversine GPS Verification Active (30m)</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black">
                  Ready to mark your attendance?
                </h2>
                <p className="text-sm text-indigo-100 max-w-lg">
                  When your teacher presents the 4-digit passcode, enter it below to record your check-in.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('mark')}
                className="px-6 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl font-bold text-sm transition shadow-lg flex items-center gap-2 active:scale-95 whitespace-nowrap"
              >
                <KeyRound className="w-4 h-4" />
                <span>Enter Passcode</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Attendance Strip Component */}
            <AttendanceStrip
              overall={stripData.overall}
              subjectStrips={stripData.subjectStrips}
            />
          </div>
        )}

        {/* TAB 2: MARK ATTENDANCE CODE INPUT */}
        {activeTab === 'mark' && (
          <div className="max-w-md mx-auto space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
                <KeyRound className="w-7 h-7" />
              </div>

              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Enter 4-Digit Session Code
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Your device will verify your presence with the teacher's active session.
              </p>

              <form onSubmit={handleMarkAttendance} className="space-y-5">
                <div>
                  <input
                    type="text"
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0 0 0 0"
                    className="w-full text-center text-4xl font-black tracking-[0.6em] py-4 rounded-2xl border-2 border-indigo-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition font-mono bg-slate-50/50"
                    autoFocus
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-left flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-slate-600">
                    <p className="font-bold text-slate-800">Classroom Presence Verification</p>
                    <p className="mt-0.5 text-slate-500">
                      High precision Geofence & passcode match.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || code.length !== 4}
                  className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify GPS & Check In</span>
                      <CheckCircle className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: ATTENDANCE HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Attendance Log History</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every verified check-in recorded for your profile.
              </p>
            </div>

            {history.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No attendance records yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Once you check in with a session code, records will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-4 px-6">Subject</th>
                        <th className="py-4 px-6">Date</th>
                        <th className="py-4 px-6">Check-in Time</th>
                        <th className="py-4 px-6">Session Code</th>
                        <th className="py-4 px-6 text-right">Verification Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">
                            {item.subject}
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-600 font-semibold">
                            {new Date(item.date).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-500 font-mono">
                            {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                            {item.code || '••••'}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Present (GPS Verified)
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
    </div>
  );
};

export default StudentDashboard;
