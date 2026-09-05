import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  UserCheck, 
  Lock, 
  Mail, 
  User, 
  BookOpen, 
  Hash, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const Login = ({ initialRole = 'student', onRoleChange, onSuccess }) => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState(initialRole); // 'student' | 'teacher'
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    subject: 'Computer Science & Engineering',
    rollNumber: '',
    class: 'CS-4A',
    section: 'A'
  });

  const handleRoleSwitch = (newRole) => {
    setRole(newRole);
    setErrorMessage('');
    setSuccessMessage('');
    if (onRoleChange) onRoleChange(newRole);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMessage) setErrorMessage('');
  };

  // Quick Demo Login Helper for seamless testing
  const handleQuickDemo = async (demoRole) => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const demoEmail = demoRole === 'teacher' ? 'teacher@myera.edu' : 'student@myera.edu';
      const demoPass = 'password123';
      
      let res;
      if (demoRole === 'teacher') {
        res = await authAPI.teacherLogin({ email: demoEmail, password: demoPass });
      } else {
        res = await authAPI.studentLogin({ email: demoEmail, password: demoPass });
      }

      const { token, user, message } = res.data;
      login(token, user);
      setSuccessMessage(message || 'Welcome back!');

      if (onSuccess) {
        onSuccess(user);
      } else {
        navigate(user.role === 'teacher' ? '/teacher' : '/student');
      }
    } catch (err) {
      // If demo account doesn't exist, autofill form
      setFormData(prev => ({
        ...prev,
        email: demoRole === 'teacher' ? 'teacher@myera.edu' : 'student@myera.edu',
        password: 'password123',
        name: demoRole === 'teacher' ? 'Prof. Amit Sharma' : 'Rahul Kumar',
        rollNumber: 'CS2024-042',
        class: 'CS-4A',
        section: 'A'
      }));
      setErrorMessage('Enter details and click Register to create your account.');
    } finally {
      setLoading(false);
    }
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
      setSuccessMessage(message || 'Welcome to MyEra!');

      if (onSuccess) {
        onSuccess(user);
      } else {
        navigate(user.role === 'teacher' ? '/teacher' : '/student');
      }
    } catch (err) {
      console.error('Auth error:', err);
      const msg = err.response?.data?.message || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-human rounded-3xl p-6 sm:p-8 space-y-6">
      {/* Role Toggle Tabs */}
      <div className="flex bg-blue-50/80 p-1 rounded-2xl border border-blue-100">
        <button
          type="button"
          onClick={() => handleRoleSwitch('student')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            role === 'student'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-blue-700'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Student</span>
        </button>
        <button
          type="button"
          onClick={() => handleRoleSwitch('teacher')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            role === 'teacher'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-blue-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Teacher</span>
        </button>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          {isRegister
            ? `Register as ${role === 'teacher' ? 'Teacher' : 'Student'}`
            : `${role === 'teacher' ? 'Teacher' : 'Student'} Sign In`}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isRegister
            ? 'Fill in your details below to create your account.'
            : 'Enter your email and password to access your dashboard.'}
        </p>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs font-semibold text-blue-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegister && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={role === 'teacher' ? 'Prof. Amit Sharma' : 'Rahul Kumar'}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                required
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              minLength={6}
            />
          </div>
        </div>

        {/* Role-Specific Fields during Registration */}
        {isRegister && role === 'teacher' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                required
              />
            </div>
          </div>
        )}

        {isRegister && role === 'student' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Class / Branch
                </label>
                <input
                  type="text"
                  name="class"
                  value={formData.class}
                  onChange={handleInputChange}
                  placeholder="CS-4A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-blue-100 bg-blue-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Section
                </label>
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  placeholder="A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-blue-100 bg-blue-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  required
                />
              </div>
            </div>


          </>
        )}

        {/* Submit Action */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl btn-bright-blue font-bold text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>{isRegister ? 'Complete Registration' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>



      {/* Switch between Sign In and Sign Up */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setErrorMessage('');
            setSuccessMessage('');
          }}
          className="text-xs font-semibold text-slate-600 hover:text-blue-700 transition"
        >
          {isRegister ? (
            <span>Already have an account? <strong className="text-blue-600 underline">Sign In</strong></span>
          ) : (
            <span>New to MyEra? <strong className="text-blue-600 underline">Create Account</strong></span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Login;
