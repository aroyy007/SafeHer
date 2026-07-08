/**
 * Upload a profile photo to Firebase Storage and return its public URL.
 *
 * Used during signup so the user's photo ends up attached to their row
 * (and gets shown to trusted contacts on the SOS active screen).
 *
 * Storage path: profile_photos/<uid>/<timestamp>.<ext>
 * The file is publicly readable so the /track page can render it
 * without an extra login flow.
 */

import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getApps } from 'firebase/app';
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getOrInitApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp(firebaseConfig);
}

function getExtFromMime(mime) {
  if (!mime) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic')) return 'heic';
  return 'jpg';
}

/**
 * @param {File} file
 * @param {string} uid  A stable user id (we use the local sessionId until backend signup finishes)
 * @returns {Promise<string>} public download URL
 */
export async function uploadProfilePhoto(file, uid) {
  if (!file) return '';
  const app = getOrInitApp();
  const storage = getStorage(app);
  const ext = getExtFromMime(file.type);
  const path = `profile_photos/${uid}/${Date.now()}.${ext}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type || `image/${ext}` });
  const url = await getDownloadURL(ref);
  return url;
}

/**
 * Read a File into a data URL — used for a local preview before upload.
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}