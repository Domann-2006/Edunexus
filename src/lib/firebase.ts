import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize anonymous auth for storage access if not using Firebase Auth elsewhere
signInAnonymously(auth).catch((err) => console.error('Firebase Anonymous Auth failed:', err));

export default app;
