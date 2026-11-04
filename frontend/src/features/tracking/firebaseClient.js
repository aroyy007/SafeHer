import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, update, remove } from 'firebase/database';

// Firebase configuration is loaded from environment variables so the same
// build works in dev, staging, and production. See .env.example for the
// full list. If any value is missing, Firebase will simply not initialize
// and `isFirebaseReady` will be false — the UI shows a clean empty state
// instead of crashing.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let db = null;

try {
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('your_')) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Firebase init failed:', error);
}

export const isFirebaseReady = !!db;
export const TRACKING_TTL_MS = 24 * 60 * 60 * 1000;

export const updateLiveLocation = (sessionId, lat, lng, createdAt, expiresAt) => {
  if (!db || !sessionId || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return Promise.resolve(false);
  }

  const locationRef = ref(db, 'locations/' + sessionId);
  return update(locationRef, {
    createdAt,
    expiresAt,
    lat,
    lng,
    timestamp: Date.now(),
  }).then(() => true).catch(err => {
    console.error("Firebase update failed:", err);
    return false;
  });
};

/**
 * Push profile metadata (name, photo URL) into the same Realtime DB
 * node so the /track page can render "It's really Nadia" alongside
 * the live marker. Called once per SOS activation. The fixed expiry is
 * written atomically with the profile so profile-only sessions also expire.
 */
export const updateSessionProfile = (sessionId, { name, photoUrl, phone }, { createdAt, expiresAt }) => {
  if (!db || !sessionId || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return Promise.resolve(false);
  }

  return update(ref(db, 'locations/' + sessionId), {
    createdAt,
    expiresAt,
    profile: {
      name: name || '',
      photoUrl: photoUrl || '',
      phone: phone || '',
      updatedAt: Date.now(),
    },
  }).then(() => true).catch(err => {
    console.error('Firebase profile update failed:', err);
    return false;
  });
};

export const subscribeToLocation = (userId, callback, onError = () => {}) => {
  if (!db) return () => {};
  const locationRef = ref(db, 'locations/' + userId);
  onValue(
    locationRef,
    (snapshot) => callback(snapshot.val()),
    onError,
  );

  return () => off(locationRef);
};

export const clearSessionLocation = (sessionId) => {
  if (!db || !sessionId) return Promise.resolve(false);
  return remove(ref(db, 'locations/' + sessionId)).then(() => true).catch((err) => {
    console.error('Firebase session cleanup failed:', err);
    return false;
  });
};
