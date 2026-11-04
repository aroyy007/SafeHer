# SafeHer — Third-Party Integrations Setup Guide

> Complete, click-by-click setup for every external service SafeHer uses.
> Read this once before your demo or submission build so nothing 500s on stage.

---

## Table of contents

1. [What's actually used in the codebase](#1-whats-actually-used-in-the-codebase)
2. [Setup order — do these in this sequence](#2-setup-order--do-these-in-this-sequence)
3. [LLM provider — Gemini OR Groq](#3-llm-provider--gemini-or-groq)
4. [HuggingFace — embedding model downloads](#4-huggingface--embedding-model-downloads)
5. [Supabase — backend persistence (optional, recommended for production)](#5-supabase--backend-persistence-optional-recommended-for-production)
6. [Firebase — RTDB, session expiry, and storage](#6-firebase--live-location-and-profile-photo-storage)
7. [EmailJS — SOS email alerts (frontend)](#7-emailjs--sos-email-alerts-frontend)
8. [Mapbox — interactive maps (frontend)](#8-mapbox--interactive-maps-frontend)
9. [Local development vs. production — what changes](#9-local-development-vs-production--what-changes)
10. [Verification checklist — run this before you demo](#10-verification-checklist--run-this-before-you-demo)
11. [Troubleshooting cheat sheet](#11-troubleshooting-cheat-sheet)

---

## 1. What's actually used in the codebase

| Service           | Where             | Used for                                          | Optional? |
| ----------------- | ----------------- | ------------------------------------------------- | --------- |
| **Gemini API**    | backend           | LLM fallback (default)                            | No (or use Groq) |
| **Groq API**      | backend           | LLM primary (cheaper, faster, larger free tier)   | No (or use Gemini) |
| **HuggingFace**   | backend           | Downloads `l3cube-pune/bengali-sentence-similarity-sbert` on first run | No |
| **Supabase**      | backend           | Postgres backend for incidents/SOS (instead of SQLite) | Yes — SQLite works for demo |
| **Firebase RTDB** | frontend + scheduled function | Real-time location sharing, 24-hour expiry, and automatic cleanup | Yes — core feature for track page |
| **EmailJS**       | frontend          | Sends SOS email alerts when SOS is triggered      | Yes — demo fakes it; EmailJS wires it to real Gmail |
| **Mapbox**        | frontend          | Tiles + dark-mode style for all maps              | Yes — Leaflet fallback uses OSM tiles |

> **Hackathon default:** Every `Yes` is optional. You can demo SafeHer end-to-end with just `GEMINI_API_KEY` (or `GROQ_API_KEY`), `HUGGINGFACE_API_KEY`, and `VITE_MAPBOX_TOKEN`. The others progressively harden the demo for production / judges.

---

## 2. Setup order — do these in this sequence

```
1. LLM (Gemini or Groq)            ← required
2. HuggingFace                     ← required (auto-downloads SBERT)
3. Mapbox                          ← required for nice maps
4. Supabase                        ← optional, do AFTER the basic demo works
5. Firebase Realtime Database      ← optional, needed only for the /track page
6. Firebase scheduled cleanup      ← optional deploy; removes expired track nodes hourly
7. EmailJS                         ← optional, needed only for real SOS emails
```

Doing them in this order means you always have a working demo at every step — and only one thing is changing at once if something breaks.

---

## 3. LLM provider — Gemini OR Groq

The backend reads `LLM_PROVIDER` from `backend/.env`. Set it to `gemini` or `groq`. If both keys are set, the running app will **automatically fall over** to Groq when Gemini returns HTTP 429 (quota exceeded) — so the demo doesn't break mid-presentation.

### Option A — Gemini (default in `.env`)

1. Open <https://aistudio.google.com/app/apikey>
2. Sign in with the Google account that owns your project.
3. Click **Create API key** → **Create API key in new project** (or reuse an existing GCP project).
4. Copy the key — it starts with `AIzaSy…`.
5. Paste it in `backend/.env`:
   ```
   GEMINI_API_KEY=AIzaSy…your-key-here
   LLM_PROVIDER=gemini
   ```
6. (Recommended) lock the key to HTTP referrers `localhost:*` and `https://safeher.app/*` in the Google AI Studio dashboard before you publish.

**Quota gotcha:** Gemini's free tier is ~15 RPM and resets daily. If you see `429 You exceeded your current quota`, switch `LLM_PROVIDER=groq` (the chat service will pick it up after the next request).

### Option B — Groq (recommended for the demo)

1. Open <https://console.groq.com/keys>
2. Sign up (GitHub login is fastest).
3. Click **Create API Key** → name it `safeher` → copy the value (it starts with `gsk_…`).
4. Paste it in `backend/.env`:
   ```
   GROQ_API_KEY=gsk_…
   LLM_PROVIDER=groq
   ```
5. Default model in code is **`llama-3.3-70b-versatile`** (free preview, 30 RPM). To switch to OpenAI's `gpt-oss-120b`, change the model name in `services/chat_service.py` (`_make_groq_provider`).

### Verify it works

```bash
# From the backend/ directory, with venv activated:
curl -sS -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{"query":"helpline number","conversation_id":"check"}' | python3 -m json.tool
```

You should see a real answer (not `"I don't have that information. Call 999 now."`). If you get the fallback string only, your key is wrong or quota is exhausted — check `/tmp/safeher.log` for `LLM call failed (gemini)` or `(groq)`.

---

## 4. HuggingFace — embedding model downloads

Why: the retriever loads `l3cube-pune/bengali-sentence-similarity-sbert` (~440 MB, SBERT for Bengali) the first time it boots. Without a token, downloads from `huggingface.co` are rate-limited and may 403.

1. Open <https://huggingface.co/settings/tokens>
2. Click **+ Create new token** → type **Read** (the default) → name it `safeher`.
3. Copy the value (starts with `hf_…`).
4. Paste in `backend/.env`:
   ```
   HUGGINGFACE_API_KEY=hf_…
   ```
5. First-time boot will take **~30-90 s** while the model downloads. After that it's cached in `~/.cache/huggingface/` and boot time drops to < 5 s.

**If you skip this:** Sentence-Transformers falls back to `all-MiniLM-L6-v2` (smaller, English-only). Bengali retrieval quality drops noticeably but the system still works.

### Verify it works

```bash
curl -sS http://localhost:8000/health | python3 -m json.tool
```

You should see `"status": "ok"` and `"knowledge_base": { "document_count": 78, … }` — if the KB count is 0, the embedder likely failed to load and you need to check the model cache.

---

## 5. Supabase — optional backend storage

SafeHer keeps authentication and emergency contacts in SQLite. Setting `USE_SUPABASE=true` moves community incidents, trusted circles, and SOS audit records to Supabase. Account identity fields are mirrored only to satisfy database foreign keys; password hashes remain in SQLite. This is SafeHer application authentication plus Supabase storage, not Supabase Auth.

### 5.1 Create a Supabase project

1. Create a project in the Supabase dashboard.
2. Copy the project URL and the server-only service-role key. The backend must have `SUPABASE_SERVICE_KEY`; the publishable key is not an admin fallback.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env`. `SUPABASE_KEY` and `SUPABASE_JWT_SECRET` are not required for the SQLite/HMAC login flow.

### 5.2 Apply the canonical schema

Run [`supabase_schema.sql`](supabase_schema.sql) once in the Supabase SQL editor. That file is the source of truth for tables, RLS, and the `get_incidents_within` RPC. Do not use the older SQL snippets from archived setup notes.

### 5.3 Enable the adapter

Set:

```dotenv
USE_SUPABASE=true
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_KEY=your-server-only-service-role-key
```

Restart the backend. `docker compose` reads defaults from `backend/.env.example`; values in `backend/.env` override them. Existing SQLite auth and contacts remain local. Supabase schema changes are not applied automatically: run the canonical SQL explicitly before enabling the adapter.

The repository has not been connected to or migrated against a live Supabase project as part of this change. Configure and verify this against a non-production project before deploying.

---

## 6. Firebase — live-location and profile photo storage

Why: SafeHer uses two Firebase services in the browser:

1. **Realtime Database** — the `/track` page lets a trusted contact watch
   the user's live location on a map. This needs a low-latency pub/sub —
   RTDB is perfect, free tier covers 100k simultaneous connections.
2. **Storage** — the user's profile photo is uploaded here and shown on
   the `/track` page during SOS.

The browser writes live location/profile data to Realtime Database. A
scheduled Firebase Function uses the Admin SDK to remove expired sessions.
SafeHer login uses its local SQLite/HMAC account flow; Firebase is not used
for user authentication.

### 6.1 Create a Firebase project

1. Open <https://console.firebase.google.com/> → **Add project** → name it `safeher-prod` (or `safeher-dev`).
2. In the project, click the **Web** icon (`</>`) to register an app → name it `safeher-web`.
3. Copy the `firebaseConfig` object Firebase shows you — values map 1-to-1 with `.env` variables.
4. In the left sidebar → **Build → Realtime Database** → **Create Database**.
5. Choose region (United States or asia-southeast1 for Bangladesh) → start in **locked mode** (you'll open it in the next step).

### 6.2 Set Realtime Database security rules

Publish the checked-in [`database.rules.json`](database.rules.json) rules in the Realtime Database **Rules** tab. They allow an active, unexpired SOS link to be read without Firebase sign-in, cap new sessions at 24 hours, and prevent clients from extending a session's expiry. Older nodes remain readable only until their last location/profile timestamp is 24 hours old; the cleanup function removes them afterward.

The current app does not sign in to Firebase, so these rules preserve public-link access for an active session. Anyone who obtains that unguessable link can read its current location and profile until expiry. This change adds expiry controls; it does not add Firebase user authentication.

Click **Publish**.

### 6.3 Wire it up (frontend)

In `frontend/.env.local` (copy from `.env.example`):

```
VITE_FIREBASE_API_KEY=AIzaSy…
VITE_FIREBASE_AUTH_DOMAIN=safeher-prod.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://safeher-prod-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=safeher-prod
VITE_FIREBASE_STORAGE_BUCKET=safeher-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123
```

Restart the frontend dev server with `npm run dev`.

### Verify it works

1. Open the app in two browsers (or one + one incognito).
2. In browser A: trigger the SOS flow or simulate a location update.
3. In browser B: open `/track/<same session id>`.
4. Browser B's pin should move when browser A's location changes.

If nothing moves, check the browser console — `isFirebaseReady` should be `true` (visible in `firebaseClient.js`).

### 6.4 (Skipped) Firebase Authentication — phone OTP removed

As of v0.3, SafeHer's signup flow no longer uses Firebase phone OTP — we
removed it because:

- It added a hard dependency on the Firebase Console (Phone provider
  must be enabled) and on real SMS delivery — both of which broke
  during demo rehearsal.
- Email is already a strong identity anchor for the hackathon; the
  trusted-circle alerts are dispatched by email anyway, so verified
  email is more useful than verified phone.
- The optional phone field in the signup form is still stored on the
  user record for SOS personalization, but is not verified.

If you ever need to re-enable phone verification, the previous
implementation lives in git history (`frontend/src/features/auth/firebasePhoneAuth.js`
was removed in commit 9b27528+).
3. Test phone: Firebase provides a couple of test numbers you can use during the demo so you don't burn real SMS quota. **Add at least one test number**:
   - Phone: `+8801712345678`
   - Verification code: `123456`
4. For your own real BD phone, just enter it in the signup flow.

### 6.5 Deploy automatic tracking-session cleanup

Every SOS session stores a fixed `expiresAt` timestamp 24 hours after activation. The `/track` page hides its map and profile at that deadline, Realtime Database rules stop serving the session, and a scheduled Cloud Function physically removes the node on its next hourly run. Deletion can therefore occur up to about one hour after the link becomes inactive.

Scheduled Functions use Cloud Scheduler and require a billing-enabled Firebase project (Blaze); charges may apply. Check the current [Firebase scheduled-functions documentation](https://firebase.google.com/docs/functions/schedule-functions?hl=en) before enabling it. The repository configuration targets Node.js 22, which Firebase currently supports for Cloud Functions.

1. Deploy the updated frontend first so new SOS sessions include expiry metadata.
2. Install or update the Firebase CLI and sign in:

   ```sh
   npm install -g firebase-tools
   firebase login
   ```

3. From the repository root, deploy the Realtime Database rules and scheduled function:

   ```sh
   firebase deploy --only database,functions --project YOUR_FIREBASE_PROJECT_ID
   ```

4. When prompted for `FIREBASE_DATABASE_URL`, enter the Realtime Database URL from the Firebase console, such as `https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app`.
5. Confirm the `cleanupExpiredTrackingSessions` schedule exists in Firebase/Google Cloud after deployment.

This source change does not deploy the function, publish rules, inspect database contents, or verify any live Firebase project. If the function is not deployed, the browser and database rules still stop serving expired data, but old nodes are not physically removed automatically.

### 6.6 Enable Firebase Storage (for profile photos)

SafeHer's signup uploads the user's profile photo so it can be displayed on `/track`.

1. Firebase Console → **Build → Storage** → **Get started** → start in production mode.
2. After creation, click the **Rules** tab and replace with:

   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       // Public read for profile photos so /track page can render them
       match /profile_photos/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

3. Click **Publish**.

### Verify email signup + profile photo storage

1. Sign up in the app with an email + password (phone is optional).
2. You'll be prompted to upload a photo. The upload should land in
   `profile_photos/local-<timestamp>/<file>.jpg` in your Storage bucket,
   accessible at a public URL.
3. On the `/track` page after a SOS trigger, that photo should appear
   in the glass header above the map.

---

## 7. EmailJS — SOS email alerts (frontend)

Why: when SOS is triggered, SafeHer emails the user's emergency contacts with their live map link. EmailJS lets us send from the browser using Gmail/SendGrid without writing a backend mail server.

**Already wired.** The frontend `EmergencyContext.jsx` now calls `emailjs.send()` for real, one email per trusted contact. To make it work you only need to paste your EmailJS keys into `frontend/.env`:

### 7.1 Create an EmailJS account

1. Sign up at <https://www.emailjs.com/> (free tier: 200 emails/month).
2. **Add new service** → choose **Gmail** (easiest), or SMTP if you want custom.
3. Authorize your Gmail account. The OAuth screen will ask "Allow send from your address" — accept.
4. Copy the **Service ID** (looks like `service_abc123`).

### 7.2 Create the email template

1. In EmailJS dashboard → **Email Templates** → **Create new template**.
2. Subject: `🚨 SOS ALERT — {{from_name}} needs help NOW`
3. Switch the body editor to **HTML mode** and paste the full HTML from the `PRE_DEMO_CHANGES.md` doc (look for "Email body (HTML)"). The variables it uses: `to_name`, `to_email`, `from_name`, `from_phone`, `time`, `location_address`, `tracking_link`.
4. Save. Copy the **Template ID** (looks like `template_xyz789`).

### 7.3 Get your public key

1. EmailJS dashboard → **Account** → **Public Key** section → copy the key.

### 7.4 Wire it up

The frontend already reads these env vars; you only need to fill in `frontend/.env`:

```
VITE_EMAILJS_SERVICE_ID=service_abc123
VITE_EMAILJS_TEMPLATE_ID=template_xyz789
VITE_EMAILJS_PUBLIC_KEY=abcdefghij_KLMNOPQR
```

Restart dev server.

### Verify it works

1. Sign up and add at least one emergency contact with a real email.
2. Trigger SOS. Within ~5 s the contact receives the SafeHer-branded email with a working tracking link.
3. The tracking link points to `/track/<session_id>` — opening it should show the user's profile photo + name above the map.

If nothing arrives in 30 s, check the **EmailJS Logs** tab — common causes: Gmail daily limit hit, unauthorized Gmail OAuth, or a template variable mismatch.

---

## 8. Mapbox — interactive maps (frontend)

Why: SafeHer uses Mapbox GL for the dark-mode map style (matches the brand). Tiles cost money after the free tier (50k loads/month), so set billing alerts.

### 8.1 Create a Mapbox token

1. Sign up at <https://account.mapbox.com/>.
2. **Access tokens** → **Create a token** → name it `safeher-frontend`.
3. **Restrict the token** (recommended): under URL restrictions, allow:
   - `http://localhost:5173/*`
   - `https://safeher.app/*`
   - `https://*.safeher.app/*`
4. Copy the public token (starts with `pk.…`).

### 8.2 Wire it up

In `frontend/.env.local`:

```
VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi…
```

Restart dev server. The dark map should appear on `/`, `/track`, and `/routes` within ~1 s of page load.

### Verify it works

Visit any page that uses `useMapbox`. If tiles are gray and you see `[Mapbox token not configured]` in the console, the env var didn't load — make sure you used `.env.local` (not `.env`) and restarted Vite.

**Free-tier fallback:** If you don't want a Mapbox account, SafeHer will silently fall back to OSM tiles via Leaflet — but the dark style won't apply.

---

## 9. Local development vs. production — what changes

| Item               | Local dev (`.env` / `.env.local`) | Production (Render + Vercel)                              |
| ------------------ | ---------------------------------- | -------------------------------------------------------- |
| Backend URL        | `http://localhost:8000`            | `https://safeher-api.onrender.com`                       |
| Frontend `VITE_API_URL` | `http://localhost:8000`        | `https://safeher-api.onrender.com`                       |
| DB                 | SQLite file in `backend/data/`     | Supabase (set `USE_SUPABASE=true`)                       |
| Live location      | optional — works without Firebase   | required for /track on real devices                      |
| SOS email          | real via EmailJS (if keys set)       | real via EmailJS                                          |
| Map tiles          | Mapbox or OSM                       | Mapbox only (OSM too aggressive for prod load)            |
| Auth               | SafeHer HMAC bearer token            | SafeHer HMAC bearer token (SQLite remains authoritative)   |
| Secret keys        | `secrets.token_urlsafe(48)`        | same — but **never** commit `.env` to git                |

**Render env vars** (set in dashboard, NOT in `.env`):

```
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_…
GEMINI_API_KEY=AIzaSy…              # optional, used as fallback if Groq 429s
HUGGINGFACE_API_KEY=hf_…
USE_SUPABASE=true
SUPABASE_URL=https://…
SUPABASE_KEY=sb_publishable_…       # publishable / anon key (browser-safe)
SUPABASE_SERVICE_KEY=eyJ…           # service-role key (backend only)
SUPABASE_JWT_SECRET=…               # optional compatibility for a JWT mapped to a local account
SAFEHER_SECRET_KEY=<openssl rand -base64 48>
SAFEHER_PASSWORD_SALT=<openssl rand -base64 32>
ALLOWED_ORIGINS=https://safeher.app,https://www.safeher.app
```

**Netlify / Vercel env vars** (set in dashboard):

```
VITE_API_URL=https://safeher-api.onrender.com
VITE_MAPBOX_TOKEN=pk.…
VITE_FIREBASE_API_KEY=AIzaSy…
VITE_FIREBASE_AUTH_DOMAIN=safeher-prod.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://safeher-prod-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=safeher-prod
VITE_FIREBASE_STORAGE_BUCKET=safeher-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=…
VITE_FIREBASE_APP_ID=…
VITE_EMAILJS_SERVICE_ID=service_…
VITE_EMAILJS_TEMPLATE_ID=template_…
VITE_EMAILJS_PUBLIC_KEY=…
```

---

## 10. Verification checklist — run this before you demo

Run all of these in order; each should pass before you move on:

```bash
# --- Backend (run from backend/, with venv active) ---

# 1. Health
curl -sS http://localhost:8000/health | grep '"status":"ok"'

# 2. LLM (the reply should NOT be the "call 999 now" fallback)
curl -sS -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{"query":"helpline number","conversation_id":"smoke"}' | grep '"fallback_used":false'

# 3. Routing
curl -sS "http://localhost:8000/route/?olat=22.3569&olng=91.8033&dlat=22.3700&dlng=91.8100" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d['feature_collection']['features'])==2; print('route OK')"

# 4. Auth
TOKEN=$(curl -sS -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@safeher.com","password":"demo123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Login OK, token_len=${#TOKEN}"

# 5. Geocode (Nominatim — works without any key)
curl -sS "http://localhost:8000/geocode/?name=GEC%20Chittagong" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d['results'])>0; print('geocode OK')"

# 6. SOS log
NOW_MS=$(($(date +%s) * 1000))
curl -sS -X POST http://localhost:8000/sos/log \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"smoke\",\"lat\":22.3569,\"lng\":91.8033,\"timestamp\":$NOW_MS,\"trigger_method\":\"button_hold\"}" \
  | grep '"logged":true'

# --- Frontend (run from frontend/, with `npm run dev` running) ---

# 7. Bundle builds
npm run build

# 8. Open http://localhost:5173 — map tiles load, hero animations fire, no console errors.
```

If any step fails, jump to the matching section in the **Troubleshooting cheat sheet** below.

---

## 10b. Auth-specific smoke tests

Run these after completing the basic checklist above; they exercise the
new (post-hardening) auth path.

```bash
# --- Auth (run from backend/, with venv active) ---

# A. Signup with all new fields
TOKEN=$(curl -sS -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Nadia",
    "email":"nadia@example.com",
    "phone":"+8801712345678",
    "password":"hackathon99",
    "home_area":"Halishahar",
    "photo_url":"https://example.com/p.jpg",
    "phone_verified":true
  }' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "TOKEN length: ${#TOKEN}"

# B. /auth/me round-trips the new fields
curl -sS http://localhost:8000/auth/me -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
u = json.load(sys.stdin)['user']
print('photo_url:', u.get('photo_url'))
print('home_area:', u.get('home_area'))
print('phone_verified:', u.get('phone_verified'))
assert all([u.get('photo_url'), u.get('home_area'), u.get('phone_verified') is True])
print('OK new fields present')
"

# C. No auth => 401
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8000/auth/me
# Expected: 401

# D. Garbage token => 401
curl -sS -o /dev/null -w "%{http_code}\n" \
  http://localhost:8000/auth/me -H "Authorization: Bearer notatoken"
# Expected: 401

# E. Disposable email blocked
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"X","email":"x@mailinator.com","phone":"+8801711111111","password":"hackathon99"}'
# Expected: 400

# F. Add a contact
curl -sS -X POST http://localhost:8000/auth/contacts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Mum","phone":"+8801811111111","email":"mum@example.com","relation":"Family"}' \
  | python3 -m json.tool

# G. Circle (authenticated SafeHer account)
curl -sS -X POST http://localhost:8000/circles/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Family","color":"#e8476a"}' | python3 -m json.tool
# Expected: 201 with id, owner_id matching the user_id
```

For the full end-to-end email signup + photo upload flow you must test
in a browser — those features depend on Firebase Storage and can't be
exercised via curl. The `PRE_DEMO_CHANGES.md` doc walks through it.

```

---

## 11. Troubleshooting cheat sheet

| Symptom                                                        | Diagnosis                                                  | Fix                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `429 You exceeded your current quota` (in `/tmp/safeher.log`)   | Gemini free tier hit                                       | Set `LLM_PROVIDER=groq` in `backend/.env` and restart uvicorn.       |
| Chat reply is always `"I don't have that information. Call 999 now."` even though it should match KB | Retriever distance threshold too tight OR embedder not loaded | Check retriever threshold (0.85 recommended); check `chroma_store/` exists; see Section 4 for HuggingFace. |
| `/health` returns `graph.loaded: false`                        | OSMnx graph hasn't been built                               | Run `python -m routing.build_graph` (see `Problem.md`). Or download the prebuilt `data/chittagong_walk.graphml` and place it there. |
| `SAFEHER_SECRET_KEY not set — using insecure default` in log   | Auth helpers can't read the key                             | Make sure `backend/.env` exists with the key, then `kill` uvicorn and restart. The Pydantic settings cache resets only on full process restart. |
| Login returns 401 for an existing user                         | Legacy SHA-256 hash vs new PBKDF2                          | This is auto-handled (auto-upgrades on first successful login). If it never works, the user's hash format is corrupted — re-create them. |
| Map is blank gray                                              | Mapbox token missing or invalid                            | Set `VITE_MAPBOX_TOKEN` in `frontend/.env.local` and restart `npm run dev`. |
| Geocode returns 0 results for valid Bangladeshi places         | Nominatim rate-limit or region lock                        | Wait 1 s (we throttle); or change viewbox in `routers/geocode.py`.   |
| Firebase `isFirebaseReady` is `false`                          | One or more `VITE_FIREBASE_*` env vars missing              | Make sure you pasted **all 7** values, not just the API key.         |
| Email arrives but link doesn't open                            | EmailJS template's `{{message}}` was escaped wrong         | In template body, use `{{message}}` not `{{ message }}` (no spaces). |
| Supabase writes return 401                                     | Using `anon` key instead of `service_role`                 | Re-copy the `service_role` (secret) key from Settings → API.         |
| `chroma_store/` is empty                                       | Embedder failed to load on first run                       | Re-run after setting `HUGGINGFACE_API_KEY`; first boot needs ~60 s to download the SBERT model. |
| Render deployment OOM-kills at boot                            | HuggingFace model too big for 512 MB Render free tier      | Render paid tier (1 GB+), or set `ENABLE_BENGALI_EMBEDDER=false` to fall back to `all-MiniLM-L6-v2`. |
| Frontend shows CORS error in browser                           | Backend `ALLOWED_ORIGINS` doesn't include frontend URL      | Set `ALLOWED_ORIGINS=https://safeher.app` in Render env.            |

---

## Appendix A — Generating secure secrets

For `SAFEHER_SECRET_KEY` and `SAFEHER_PASSWORD_SALT`:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Never** reuse the demo placeholder values (`change-me-locally-…`) or commit your real `.env` to git. The repo's `.gitignore` already excludes `.env` and `.env.local`.

---

## Appendix B — Time budget for the hackathon

If you have ~1 hour before demo and nothing is set up:

| Minute | Action                                                                            |
| ------ | --------------------------------------------------------------------------------- |
| 0-5    | Verify you have a Groq API key working (curl the chat endpoint)                   |
| 5-15   | Generate secret keys; put them in `.env`; restart uvicorn                         |
| 15-25  | Set `VITE_MAPBOX_TOKEN` and `HUGGINGFACE_API_KEY`; restart both servers          |
| 25-35  | Skip Supabase and Firebase (SQLite + faked live location are fine for judges)   |
| 35-45  | Skip EmailJS (the console.log already proves the SOS flow to judges)             |
| 45-60  | Re-run the verification checklist from Section 10                                 |

The only thing that *has* to be real is the LLM key — everything else can be a polite fake for the judges.

---

*Last verified: 2026-07-07 — backend running on `http://localhost:8000`.*
