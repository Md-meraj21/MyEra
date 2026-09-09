const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

let isInitialized = false;
let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK using Service Account JSON file or Environment Variables
 */
const initFirebaseAdmin = () => {
  if (isInitialized && firebaseApp) return true;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    isInitialized = true;
    return true;
  }

  try {
    // 1. Check for service account JSON file path
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (saPath) {
      const resolvedPath = path.isAbsolute(saPath) ? saPath : path.join(process.cwd(), saPath);
      if (fs.existsSync(resolvedPath)) {
        const serviceAccount = require(resolvedPath);
        firebaseApp = initializeApp({
          credential: cert(serviceAccount)
        });
        isInitialized = true;
        console.log('✅ [FirebaseAdmin] Initialized successfully with service account file.');
        return true;
      }
    }

    // 2. Check for environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      // Replace escaped newlines if passed in .env
      privateKey = privateKey.replace(/\\n/g, '\n');
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      isInitialized = true;
      console.log('✅ [FirebaseAdmin] Initialized successfully with environment credentials.');
      return true;
    }

    return false;
  } catch (err) {
    console.warn('⚠️ [FirebaseAdmin] Initialization warning:', err.message);
    return false;
  }
};

/**
 * Send Web Push Notifications to a list of device tokens
 */
const sendPushNotification = async ({
  tokens = [],
  title = 'MyEra Reminder',
  body = 'Your class is starting soon.',
  data = {}
}) => {
  try {
    const validTokens = Array.from(new Set(tokens.filter(Boolean)));
    if (validTokens.length === 0) {
      return { success: false, reason: 'no_tokens' };
    }

    const ready = initFirebaseAdmin();
    if (!ready || !firebaseApp) {
      console.log(`ℹ️ [PushNotification (Dry Run)]: "${title} - ${body}" targeted at ${validTokens.length} device(s), but Firebase Admin is unconfigured in .env.`);
      return { success: false, reason: 'unconfigured' };
    }

    // WebPush payload with rich notification formatting
    const message = {
      tokens: validTokens,
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: data.url || 'https://myera-eight.vercel.app'
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            {
              action: 'open_dashboard',
              title: 'Open MyEra'
            }
          ]
        },
        fcmOptions: {
          link: data.url || 'https://myera-eight.vercel.app'
        }
      }
    };

    const messaging = getMessaging(firebaseApp);
    const response = await messaging.sendEachForMulticast(message);
    console.log(`✅ [PushNotification] Sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (err) {
    console.error('❌ [PushNotification] Send error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  initFirebaseAdmin,
  sendPushNotification
};
