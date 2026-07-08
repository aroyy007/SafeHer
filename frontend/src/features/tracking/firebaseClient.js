import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, update } from 'firebase/database';

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

export const updateLiveLocation = (userId, lat, lng) => {
  if (!db) return;
  const locationRef = ref(db, 'locations/' + userId);
  set(locationRef, {
    lat,
    lng,
    timestamp: Date.now()
  }).catch(err => console.error("Firebase update failed:", err));
};

/**
 * Push profile metadata (name, photo URL) into the same Realtime DB
 * node so the /track page can render "It's really Nadia" alongside
 * the live marker. Called once per SOS activation.
 */
export const updateSessionProfile = (userId, { name, photoUrl, phone }) => {
  if (!db) return;
  const profileRef = ref(db, 'locations/' + userId + '/profile');
  set(profileRef, {
    name: name || '',
    photoUrl: photoUrl || '',
    phone: phone || '',
    updatedAt: Date.now(),
  }).catch(err => console.error('Firebase profile update failed:', err));
};

export const subscribeToLocation = (userId, callback) => {
  if (!db) return () => {};
  const locationRef = ref(db, 'locations/' + userId);
  onValue(locationRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });

  return () => off(locationRef);
};
