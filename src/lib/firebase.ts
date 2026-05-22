import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use modern persistent local cache with multi-tab storage manager
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  })
});

// Initialize anonymous auth for storage access if not using Firebase Auth elsewhere
signInAnonymously(auth).catch((err) => console.error('Firebase Anonymous Auth failed:', err));

export default app;
