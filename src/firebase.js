import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect,
  push,
  serverTimestamp,
  child,
} from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

/** Wait for anonymous auth and return uid */
export function initAuth() {
  return new Promise((resolve, reject) => {
    signInAnonymously(auth).catch(reject);
    onAuthStateChanged(auth, (user) => {
      if (user) resolve(user.uid);
    });
  });
}

export function getUid() {
  return auth.currentUser?.uid ?? null;
}

// Re-export everything callers need
export {
  db,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect,
  push,
  serverTimestamp,
  child,
};
