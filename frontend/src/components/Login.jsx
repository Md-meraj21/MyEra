import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, UserCheck, Lock, Mail, User, BookOpen, Hash, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const Login = ({ initialRole = 'teacher', onSuccess }) => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState(initialRole); // 'teacher' | 'student'
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    subject: '',
    rollNumber: '',
    class: '',
    section: 'A'
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      let res;
      if (isRegister) {
        if (role === 'teacher') {
          res = await authAPI.registerTeacher({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            subject: formData.subject
          });
        } else {
          res = await authAPI.registerStudent({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            rollNumber: formData.rollNumber,
            class: formData.class,
            section: formData.section
          });
        }
      } else {
        if (role === 'teacher') {
          res = await authAPI.teacherLogin({
            email: formData.email,
            password: formData.password
          });
        } else {
          res = await authAPI.studentLogin({
            email: formData.email,
            password: formData.password
          });
        }
      }

      const { token, user, message } = res.data;
      login(token, user);
      setSuccessMessage(message || 'Authentication successful!');

      if (onSuccess) {
        onSuccess(user);
      } else {
        if (user.role === 'teacher') {
          navigate('/teacher');
        } else {
          navigate('/student');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      const msg = err.response?.data?.message || 'Authentication failed. Please check your credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-7 sm:p-8">
      {/* Role Selection Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => { setRole('teacher'); setErrorMessage(''); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            role === 'teacher'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Teacher Portal
        </button>
        <button
          type="button"
          onClick={() => { setRole('student'); setErrorMessage(''); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            role === 'student'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Student Portal
        </button>
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          {isRegister ? `Create ${role === 'teacher' ? 'Teacher' : 'Student'} Account` : `Sign in as ${role === 'teacher' ? 'Teacher' : 'Student'}`}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isRegister
            ? 'Join MyEra to start taking smart attendance with GPS verification.'
            : 'Enter your credentials to access your personal dashboard.'}
        </p>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegister && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Dr. Sarah Johnson"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder={role === 'teacher' ? 'teacher@myera.edu' : 'student@myera.edu'}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
              minLength={6}
            />
          </div>
        </div>

        {/* Role Specific Registration Fields */}
        {isRegister && role === 'teacher' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Primary Subject / Department
            </label>
            <div className="relative">
              <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Computer Science & Engineering"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
          </div>
        )}

        {isRegister && role === 'student' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Roll Number
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  name="rollNumber"
                  value={formData.rollNumber}
                  onChange={handleInputChange}
                  placeholder="CS2024-042"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Class / Branch
                </label>
                <input
                  type="text"
                  name="class"
                  value={formData.class}
                  onChange={handleInputChange}
                  placeholder="CS-4A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Section
                </label>
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  placeholder="A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
            </div>
          </>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full mt-2 py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 ${
            role === 'teacher'
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
          }`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>{isRegister ? 'Complete Registration' : 'Sign In Now'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch between Sign In and Sign Up */}
      <div className="text-center mt-6 pt-5 border-t border-slate-100">
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setErrorMessage('');
            setSuccessMessage('');
          }}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          {isRegister ? (
            <span>Already have an account? <strong className="text-emerald-600 underline">Sign In</strong></span>
          ) : (
            <span>Don't have an account yet? <strong className="text-emerald-600 underline">Register here</strong></span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Login;
