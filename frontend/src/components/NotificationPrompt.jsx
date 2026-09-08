import React, { useState, useEffect } from 'react';
import { Bell, BellRing, CheckCircle, AlertCircle, Sparkles, Send } from 'lucide-react';
import { requestNotificationPermissionAndToken, isFirebaseConfigured } from '../services/firebase';
import { notificationAPI } from '../services/api';

const NotificationPrompt = ({ user, role = 'student' }) => {
  const [permission, setPermission] = useState('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnableReminders = async () => {
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const res = await requestNotificationPermissionAndToken();
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }

      if (res.success && res.token) {
        // Save to backend database
        await notificationAPI.saveToken({
          token: res.token,
          role,
          userId: user?._id || user?.id,
          email: user?.email
        });

        localStorage.setItem('myera_fcm_token', res.token);
        setStatusMsg({
          type: 'success',
          text: '🎉 Class reminders enabled! You will receive alerts 5 minutes before your timetable classes.'
        });
      } else if (res.reason === 'unconfigured') {
        setStatusMsg({
          type: 'info',
          text: 'Browser permission granted! (Add your Firebase config to frontend/.env to complete device token sync)'
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: res.message || 'Could not register for notifications.'
        });
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to register notification token.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestLoading(true);
    try {
      const savedToken = localStorage.getItem('myera_fcm_token');
      await notificationAPI.testReminder({
        email: user?.email,
        token: savedToken || undefined
      });
      setStatusMsg({
        type: 'success',
        text: `🚀 Test reminder dispatched to ${user?.email || 'your device'}!`
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: 'Could not trigger test reminder.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (dismissed || !('Notification' in window)) {
    return null;
  }

  // Already granted permission
  if (permission === 'granted') {
    return (
      <div className="mb-6 bg-slate-900/60 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-emerald-950/20">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <BellRing className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-white">5-Minute Class Reminders Active</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle className="w-3 h-3 mr-1 text-emerald-400" /> ON
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              You will receive push and email reminders 5 minutes before scheduled timetable slots.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSendTestNotification}
            disabled={testLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-50"
            title="Send an immediate test alert to verify setup"
          >
            <Send className="w-3 h-3 text-indigo-400" />
            <span>{testLoading ? 'Testing...' : 'Test Alert'}</span>
          </button>
        </div>

        {statusMsg && (
          <div className="w-full mt-2 text-xs py-1.5 px-3 rounded-lg flex items-center space-x-2 bg-slate-800/90 border border-slate-700 text-slate-300">
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>
    );
  }

  // Permission not granted yet (Prompt banner)
  return (
    <div className="mb-6 relative overflow-hidden bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-purple-950/60 backdrop-blur-md border border-indigo-500/30 rounded-2xl p-4 shadow-xl shadow-indigo-950/20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5 sm:mt-0">
            <Bell className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold text-white tracking-wide">Never Miss a Lecture</h4>
              <span className="flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Sparkles className="w-2.5 h-2.5 mr-1" /> 5-Min Reminders
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Enable app-style push notifications on this device to get alerted 5 minutes before every scheduled class in your timetable.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
          >
            Later
          </button>
          <button
            onClick={handleEnableReminders}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition transform active:scale-95 flex items-center space-x-2 disabled:opacity-50"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Enabling...' : 'Enable Reminders'}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`mt-3 text-xs py-2 px-3 rounded-xl flex items-center space-x-2 border ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : statusMsg.type === 'info'
            ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300'
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
};

export default NotificationPrompt;
