import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

if (!admin.apps.length) {
  let credential = admin.credential.applicationDefault(); // Fallback

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountVar) {
    try {
      const serviceAccount = JSON.parse(serviceAccountVar);
      credential = admin.credential.cert(serviceAccount);
    } catch (err) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', err);
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT not found, using applicationDefault()');
  }

  admin.initializeApp({
    credential,
  });
}

const app = admin.app();
export const db = getFirestore(app);
export const auth = getAuth(app);

export default admin;
