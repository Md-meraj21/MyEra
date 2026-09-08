import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Firebase configuration loaded from Vite environment variables (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let app = null;
let messaging = null;

export const isFirebaseConfigured = () => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && vapidKey);
};

const initFirebase = async () => {
  if (messaging) return messaging;
  if (!isFirebaseConfigured()) return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[Firebase] Firebase messaging is not supported in this browser environment.');
      return null;
    }

    if (!app) {
      app = initializeApp(firebaseConfig);
    }
    messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.error('[Firebase] Failed to initialize Firebase:', err);
    return null;
  }
};

/**
 * Request notification permission and get device registration token
 */
export const requestNotificationPermissionAndToken = async () => {
  if (!('Notification' in window)) {
    return { success: false, reason: 'unsupported', message: 'Notifications are not supported by your browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'denied', message: 'Notification permission was denied.' };
    }

    if (!isFirebaseConfigured()) {
      return {
        success: false,
        reason: 'unconfigured',
        permission: 'granted',
        message: 'Notification permission granted! (Add Firebase credentials in frontend/.env to generate device token)'
      };
    }

    const msg = await initFirebase();
    if (!msg) {
      return { success: false, reason: 'init_failed', message: 'Could not initialize messaging.' };
    }

    // Register service worker
    let registration = null;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }

    const currentToken = await getToken(msg, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: registration
    });

    if (currentToken) {
      return { success: true, token: currentToken };
    } else {
      return { success: false, reason: 'no_token', message: 'No registration token available.' };
    }
  } catch (error) {
    console.error('[Firebase] Error retrieving FCM token:', error);
    return { success: false, reason: 'error', message: error.message };
  }
};

/**
 * Listen for foreground notifications when the tab is active
 */
export const onForegroundMessage = async (callback) => {
  const msg = await initFirebase();
  if (msg) {
    return onMessage(msg, (payload) => {
      if (callback) callback(payload);
    });
  }
  return () => {};
};
