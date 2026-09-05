import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Login from '../components/Login';

const Home = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeRoleTab, setActiveRoleTab] = useState('student'); // Default to Student for friendly mobile access

  // If already authenticated, redirect to respective dashboard
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-blue-200">
      {/* Top Header - Clean & Minimal */}
      <header className="glass-header sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl btn-bright-blue flex items-center justify-center font-black text-xl shadow-md">
              M
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900">
                My<span className="text-blue-600">Era</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold text-blue-600/70 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                Attendance Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-100/60 px-3 py-1.5 rounded-xl border border-blue-200/60">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>GPS Verified</span>
          </div>
        </div>
      </header>

      {/* Main Content - Centered, Clean, Human-Friendly */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Welcoming Header */}
          <div className="text-center space-y-2">

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome to <span className="text-blue-600">MyEra</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
              Fast, simple, and accurate attendance for students and teachers.
            </p>
          </div>

          {/* Clean Login Card */}
          <Login initialRole={activeRoleTab} onRoleChange={(role) => setActiveRoleTab(role)} />
        </div>
      </main>

      {/* Footer - Minimal & Friendly */}
      <footer className="py-4 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} MyEra • Simple & Reliable Attendance</p>
      </footer>
    </div>
  );
};

export default Home;
