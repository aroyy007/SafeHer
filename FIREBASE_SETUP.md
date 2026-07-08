# SafeHer — Firebase Setup Guide

This guide walks you through enabling **Phone sign-in** in the `safeher-dev` Firebase project so the signup flow can send a real OTP. If you ever see `Firebase: Error (auth/configuration-not-found)` during signup, it's because this step was skipped.

---

## 1. Open the Firebase Console

Go to: **https://console.firebase.google.com/**

Sign in with the Google account that owns the `safeher-dev` project (typically `aroyy007@gmail.com` or whatever you used when creating the project).

Click the **`safeher-dev`** tile to enter the project.

---

## 2. Enable Phone Authentication

In the left sidebar:

1. Click **Build → Authentication**.
2. If this is the first time, click **Get Started** to initialize Auth.
3. Stay on the **Sign-in method** tab.
4. Find the **Phone** row in the provider list → click it.
5. Toggle **Enable** → **Save**.

That's it — Phone auth is now active. The frontend will be able to call `signInWithPhoneNumber()` and Firebase will send the SMS.

> **Why the error happens:** if you skip step 2, Firebase rejects every `signInWithPhoneNumber` call with `auth/configuration-not-found`. The frontend code is correct; the project is simply missing the provider configuration.

---

## 3. Add test phone numbers (optional but recommended for the demo)

To avoid burning real SMS quota during rehearsal, register a couple of test numbers:

1. Still on the **Sign-in method → Phone** page, scroll to **Phone numbers for testing**.
2. Click **Add phone number**.
3. Enter:
   - **Number**: `+8801835837800` (your real BD number)
   - **Verification code**: `123456` (any 6 digits you want)
4. Save.

Now when you sign up with that exact number, Firebase skips the real SMS send and instantly accepts `123456` as the valid OTP. The user-experience flow is identical — you just don't pay for the SMS.

Add a second test number for a teammate or another demo scenario.

---

## 4. Allow your deployment domain (production)

By default Firebase allows `localhost`. For production:

1. **Sign-in method** tab → scroll to **Authorized domains**.
2. Click **Add domain** and add:
   - `safeher.netlify.app` (or whatever Netlify gave you)
   - `safeher-api.onrender.com` (if you ever embed Firebase in the backend)
3. Save.

Without this, the invisible reCAPTCHA will fail with `auth/unauthorized-domain` on production.

---

## 5. Verify the config object in `frontend/.env`

Make sure `frontend/.env` matches the values in Firebase Console → **Project settings → General → Your apps → Web app → Config**:

```ini
VITE_FIREBASE_API_KEY=AIzaSyCBU_AjzPeqiCDVlEkiknGCMCUDtOsiYnI
VITE_FIREBASE_AUTH_DOMAIN=safeher-dev.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://safeher-dev-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=safeher-dev
VITE_FIREBASE_STORAGE_BUCKET=safeher-dev.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=209671635944
VITE_FIREBASE_APP_ID=1:209671635944:web:8ebafa3ff3eb70d533da5d
```

Any mismatch produces `auth/invalid-api-key` or `auth/project-not-found`. The values above are the safeher-dev web app's config — they were read directly from the project on 2026-07-08.

---

## 6. Verify it works

In the SafeHer frontend, go to `/signup` and walk through the 3 steps:

1. Fill name / email / phone / home_area / password.
2. Click **Send verification code** — Firebase sends the SMS (or accepts your test code instantly).
3. Enter the 6-digit code, click **Verify code**.
4. You should see **Step 3 of 3 — add a photo** appear, with a "✓ phone verified" indicator.

If the form shows any error, copy the error code (e.g. `auth/configuration-not-found`) and look it up in the [Firebase Auth error reference](https://firebase.google.com/docs/auth/admin/errors). The most common ones:

| Error code | Fix |
|---|---|
| `auth/configuration-not-found` | Re-do **Step 2** (enable Phone provider) |
| `auth/unauthorized-domain` | Re-do **Step 4** (add your domain) |
| `auth/invalid-phone-number` | Use E.164 format: `+8801712345678` |
| `auth/too-many-requests` | Wait 10 minutes; the rate limit resets |
| `auth/quota-exceeded` | Firebase Spark plan allows 10k SMS/month; upgrade to Blaze if you need more |

---

## 7. SMS pricing

Firebase's free **Spark** plan includes 10,000 SMS verifications per month. For the CUET SciBlitz demo (a few dozen test signups), this is more than enough.

If you expect a huge spike, upgrade to the **Blaze** pay-as-you-go plan (~$0.01 per SMS in Bangladesh). You can set a spending cap in the Console to avoid surprises.

---

## 8. Troubleshooting matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| `auth/configuration-not-found` | Phone provider not enabled | Step 2 |
| OTP never arrives | Wrong region, no SMS credits, or test mode typo | Step 3 + verify `+880` prefix |
| `reCAPTCHA has already been rendered` | Strict-mode double-render in dev | Refresh the page |
| `auth/network-request-failed` | Ad-blocker / corporate firewall blocks `gstatic.com` | Disable blocker for the dev domain |
| Sign-in works locally but not on Netlify | Domain not in Authorized domains | Step 4 |

---

**That's it.** Phone OTP is now wired and your signup flow will work end-to-end. Keep this file open in a tab during the demo in case you need to tweak a Firebase setting live.
