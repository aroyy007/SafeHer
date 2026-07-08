/**
 * Firebase phone OTP authentication.
 *
 * Two-step flow used during signup:
 *   1. signInWithPhoneNumber(formattedPhone, recaptcha) → returns confirmationResult
 *   2. confirmationResult.confirm(otp) → returns userCredential
 *
 * The resulting user gets a Firebase UID. We treat that UID as a
 * phone-verified identity. The Supabase JWT layer (or legacy HMAC
 * token) is what the backend actually trusts — this module just
 * provides the "verified identity proof" half of signup.
 *
 * Note: we use a SEPARATE Firebase app instance for phone auth so it
 * doesn't clash with the realtime-database app already created in
 * firebaseClient.js.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
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

let phoneAuth = null;

function ensureAuth() {
  if (phoneAuth) return phoneAuth;
  // Reuse the same default app if it already exists; otherwise create one.
  const app = getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig);
  phoneAuth = getAuth(app);
  return phoneAuth;
}

/**
 * Format a BD phone number to E.164.
 * Accepts: "+8801712345678", "01712345678", "1712345678"
 * Returns: "+8801712345678" or null if it doesn't look like a BD number.
 */
export function formatBdPhone(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[\s\-()]/g, '');
  // already +880…
  if (/^\+8801\d{9}$/.test(cleaned)) return cleaned;
  // 8801xxxxxxxxx (without +)
  if (/^8801\d{9}$/.test(cleaned)) return '+' + cleaned;
  // 01xxxxxxxxx (local)
  if (/^01\d{9}$/.test(cleaned)) return '+88' + cleaned;
  // 1xxxxxxxxx (no leading 0)
  if (/^1\d{9}$/.test(cleaned)) return '+880' + cleaned;
  return null;
}

/**
 * Build a RecaptchaVerifier inside a given DOM element id.
 * The element should be empty <div id="..."></div>.
 */
export function buildRecaptcha(containerId) {
  const auth = ensureAuth();
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // recaptcha solved — signInWithPhoneNumber will proceed
    },
    'expired-callback': () => {
      console.warn('Recaptcha expired — user must retry');
    },
  });
}

/**
 * Send OTP. Resolves with the Firebase ConfirmationResult object.
 * Pass the RecaptchaVerifier from buildRecaptcha().
 */
export async function sendOtp(recaptcha, phoneE164) {
  const auth = ensureAuth();
  return signInWithPhoneNumber(auth, phoneE164, recaptcha);
}

/**
 * Confirm the 6-digit OTP. Resolves with the Firebase UserCredential.
 * Also returns the ID token (a JWT) which the backend can verify.
 */
export async function confirmOtp(confirmationResult, otp) {
  const cred = await confirmationResult.confirm(otp);
  const idToken = await cred.user.getIdToken();
  return { user: cred.user, idToken };
}