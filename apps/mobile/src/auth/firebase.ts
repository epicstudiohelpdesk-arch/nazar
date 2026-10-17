import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Nazar Platform Firebase Web Client Configuration
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBwe92HDL56oq1ZcbEED577aKv8nWm00uE',
  authDomain: 'nazar-85664.firebaseapp.com',
  projectId: 'nazar-85664',
  storageBucket: 'nazar-85664.firebasestorage.app',
  messagingSenderId: '7814729882',
  appId: '1:7814729882:web:7ffa477eac58786b814f23',
  measurementId: 'G-XFXQ3BW84E',
};

export const getFirebaseApp = (): FirebaseApp => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

export const getFirebaseAuth = (): Auth => {
  const app = getFirebaseApp();
  return getAuth(app);
};
