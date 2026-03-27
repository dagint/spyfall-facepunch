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
  query,
  orderByChild,
  limitToLast,
} from 'firebase/database';
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';

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

/** Parse admin emails from env */
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Check if an email is in the admin list */
export function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Check if the current user is an admin */
export function isCurrentUserAdmin() {
  const email = auth.currentUser?.email;
  return isAdminEmail(email);
}

/** Get the current user's email (null for anonymous) */
export function getCurrentEmail() {
  return auth.currentUser?.email ?? null;
}

/** Wait for anonymous auth and return uid */
export function initAuth() {
  return new Promise((resolve, reject) => {
    signInAnonymously(auth).catch(reject);
    onAuthStateChanged(auth, (user) => {
      if (user) resolve(user.uid);
    });
  });
}

/** Sign in with Google (for admin access) */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: 'gmail.com' });
  const result = await signInWithPopup(auth, provider);
  const email = result.user.email;
  if (!email || !email.toLowerCase().endsWith('@gmail.com')) {
    await signOut(auth);
    throw new Error('Only Gmail accounts are allowed');
  }
  return result.user;
}

/** Sign out admin and return to anonymous auth */
export async function signOutAdmin() {
  await signOut(auth);
  await signInAnonymously(auth);
}

export function getUid() {
  return auth.currentUser?.uid ?? null;
}

// Re-export everything callers need
export {
  db,
  auth,
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
  query,
  orderByChild,
  limitToLast,
};
