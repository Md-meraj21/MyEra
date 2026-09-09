import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, CheckCircle, AlertCircle, Sparkles, Send, Smartphone, Mail, RefreshCw } from 'lucide-react';
import { requestNotificationPermissionAndToken, onForegroundMessage } from '../services/firebase';
import { notificationAPI } from '../services/api';

const NotificationPrompt = ({ user, role = 'student' }) => {
  const [permission, setPermission] = useState('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenSynced, setIsTokenSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const syncAttemptedRef = useRef(false);

  // Sync token to database for the current logged-in user
  const syncDeviceToken = async (showSuccessMsg = false) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return null;
    setIsSyncing(true);

    try {
      const res = await requestNotificationPermissionAndToken();
      if (res.success && res.token) {
        localStorage.setItem('myera_fcm_token', res.token);

        await notificationAPI.saveToken({
          token: res.token,
          role,
          userId: user?._id || user?.id,
          email: user?.email
        });

        setIsTokenSynced(true);
        if (showSuccessMsg) {
          setStatusMsg({
            type: 'success',
            text: '🎉 Push notification token connected to your account! You will receive alerts 5 mins before scheduled classes.'
          });
        }
        return res.token;
      } else {
        console.warn('FCM token generation notice:', res.message);
        return null;
      }
    } catch (err) {
      console.warn('Token sync warning:', err.message);
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  // Check initial browser permission and auto-sync token on load/login
  useEffect(() => {
    if (!('Notification' in window)) return;

    const currentPerm = Notification.permission;
    setPermission(currentPerm);

    const hasStoredToken = Boolean(localStorage.getItem('myera_fcm_token'));
    if (hasStoredToken) {
      setIsTokenSynced(true);
    }

    // If permission is already granted, auto-register token in MongoDB for this user
    if (currentPerm === 'granted' && (user?._id || user?.id || user?.email) && !syncAttemptedRef.current) {
      syncAttemptedRef.current = true;
      syncDeviceToken(false);
    }
  }, [user?._id, user?.id, user?.email]);

  // Foreground notification handler (when tab is active)
  useEffect(() => {
    let unsubscribe = null;
    onForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || '⏰ MyEra Class Alert';
      const body = payload.notification?.body || payload.data?.body || 'Your scheduled lecture is starting in 5 minutes!';

      // Display HTML5 Notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
          });
        } catch (e) {
          // Fallback if Notification constructor restricted
        }
      }

      // Show in-app banner
      setStatusMsg({
        type: 'success',
        text: `🔔 ${title}: ${body}`
      });
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
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
        localStorage.setItem('myera_fcm_token', res.token);

        await notificationAPI.saveToken({
          token: res.token,
          role,
          userId: user?._id || user?.id,
          email: user?.email
        });

        setIsTokenSynced(true);
        setStatusMsg({
          type: 'success',
          text: '🎉 Reminders activated! Push alerts & emails will arrive 5 minutes before scheduled lectures.'
        });
      } else if (res.reason === 'unconfigured') {
        setStatusMsg({
          type: 'info',
          text: 'Browser permission granted! Firebase configuration active.'
        });
      } else if (res.reason === 'denied') {
        setStatusMsg({
          type: 'error',
          text: '⚠️ Permission blocked. Click the 🔒 lock icon in your browser address bar > Permissions > Allow Notifications, then reload.'
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
    setStatusMsg(null);

    try {
      let savedToken = localStorage.getItem('myera_fcm_token');

      // If token is missing, generate and sync it right now
      if (!savedToken && 'Notification' in window && Notification.permission === 'granted') {
        savedToken = await syncDeviceToken(false);
      }

      const res = await notificationAPI.testReminder({
        email: user?.email,
        token: savedToken || undefined,
        teacherName: user?.name,
        role,
        subject: user?.subject || (role === 'teacher' ? 'Class Lecture' : 'Class Period'),
        time: 'Upcoming Period'
      });

      const emailResult = res.data?.results?.email;
      const pushResult = res.data?.results?.push;

      if (emailResult && !emailResult.success) {
        setStatusMsg({
          type: 'error',
          text: `⚠️ Email delivery failed: ${emailResult.error || 'Check SMTP configuration.'}`
        });
      } else if (pushResult && !pushResult.success && emailResult?.success) {
        setStatusMsg({
          type: 'info',
          text: `📧 Email delivered to ${user?.email}! (Push notification not received: ${pushResult.error || 'Ensure notifications are allowed in browser settings'})`
        });
      } else {
        setStatusMsg({
          type: 'success',
          text: `🚀 Test reminder dispatched to ${user?.email || 'your device'}! Check your inbox and notification tray.`
        });
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Could not trigger test reminder.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (dismissed || !('Notification' in window)) {
    return null;
  }

  // Already granted permission view
  if (permission === 'granted') {
    return (
      <div className="mb-6 bg-slate-900/70 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-emerald-950/20">
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-1">
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Smartphone className="w-3.5 h-3.5" />
                {isTokenSynced ? 'Device Push Connected' : isSyncing ? 'Connecting Device...' : 'Push Ready'}
              </span>
              <span className="text-slate-500">•</span>
              <span className="inline-flex items-center gap-1 text-indigo-300">
                <Mail className="w-3.5 h-3.5" />
                Email Alerts: {user?.email || 'Active'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!isTokenSynced && (
            <button
              onClick={() => syncDeviceToken(true)}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-950/70 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/30 transition flex items-center space-x-1.5 disabled:opacity-50"
              title="Sync device token with database"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Device'}</span>
            </button>
          )}

          <button
            onClick={handleSendTestNotification}
            disabled={testLoading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-50 shadow-sm"
            title="Send an immediate test alert to verify email and push setup"
          >
            <Send className="w-3 h-3 text-indigo-400" />
            <span>{testLoading ? 'Testing...' : 'Test Alert'}</span>
          </button>
        </div>

        {statusMsg && (
          <div className="w-full mt-2 text-xs py-2 px-3 rounded-lg flex items-center space-x-2 bg-slate-800/95 border border-slate-700 text-slate-200">
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : statusMsg.type === 'info' ? (
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="flex-1">{statusMsg.text}</span>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-slate-400 hover:text-slate-200 ml-2 text-sm font-bold"
            >
              ×
            </button>
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
          <span className="flex-1">{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-slate-400 hover:text-slate-200 ml-2 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationPrompt;
