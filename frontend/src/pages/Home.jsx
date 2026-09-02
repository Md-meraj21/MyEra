import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  GraduationCap,
  UserCheck,
  MapPin,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Zap,
  Sparkles,
  BarChart3,
  Award,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Login from '../components/Login';

const Home = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeRoleTab, setActiveRoleTab] = useState('teacher');

  // If already authenticated, redirect to respective dashboard
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-500/20">
              M
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900">
                My<span className="text-emerald-600">Era</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold text-slate-400">
                Smart Classroom Attendance
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveRoleTab('teacher')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeRoleTab === 'teacher'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Teacher Portal
            </button>
            <button
              onClick={() => setActiveRoleTab('student')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeRoleTab === 'student'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Student Portal
            </button>
          </div>
        </div>
      </header>

      {/* Hero & Login Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        {/* Left Column: Hero Text & Highlights */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Next-Gen Geofenced Classroom Attendance</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Fast, Fair & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Proxy-Proof</span> Classroom Check-in.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
            Teachers launch 2-minute dynamic attendance sessions with one click. Students verify physical presence within 30 meters using high-precision Haversine GPS technology.
          </p>

          {/* Core Feature Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-left">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 flex-shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">30m GPS Geofence</h4>
                <p className="text-xs text-slate-500 mt-0.5">Haversine formula validates physical classroom presence.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">120s Dynamic Passcodes</h4>
                <p className="text-xs text-slate-500 mt-0.5">Cryptographic 4-digit code expires automatically after 2 min.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 flex-shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Color-Coded Strips</h4>
                <p className="text-xs text-slate-500 mt-0.5">Instant progress tracking (Green ≥75%, Yellow 50-74%, Red &lt;50%).</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">One-Click Excel (.xlsx)</h4>
                <p className="text-xs text-slate-500 mt-0.5">Instant SheetJS spreadsheet export with complete summaries.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Login Box */}
        <div className="lg:col-span-5 w-full">
          <Login initialRole={activeRoleTab} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px]">M</span>
            <span>MyEra Smart Classroom System</span>
          </div>
          <p>© {new Date().getFullYear()} MyEra Attendance. MERN Stack Production Release.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
