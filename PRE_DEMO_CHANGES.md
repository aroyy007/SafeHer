# SafeHer — Pre-Demo Production Hardening

This document covers four production-grade upgrades that landed before
the SciBlitz demo on 17 July. Each section tells you: **what changed,
what env vars to set, and what to verify on stage day.**

---

## 1. Phone OTP signup (replaces NID)

**Why:** NID verification in Bangladesh requires government API access
your team doesn't have. Phone OTP via Firebase is the next best thing —
it proves the user owns the number, is free, and takes ~10 seconds.

**What you'll see during signup:** Three steps instead of one.
1. Basic info (name, email, phone, password, home_area)
2. Firebase invisible reCAPTCHA + 6-digit SMS code
3. Profile photo upload

**Files changed/added:**
- `frontend/src/features/auth/firebasePhoneAuth.js` *(new)*
- `frontend/src/features/auth/uploadProfilePhoto.js` *(new)*
- `frontend/src/pages/Auth/Signup.jsx` (3-step form)
- `frontend/src/contexts/AuthContext.jsx` (exposes `setSupabaseJwt`)
- `backend/routers/auth.py` (signup accepts `home_area`, `photo_url`, `phone_verified`)
- `backend/services/auth_service.py` (stores the new fields)
- `backend/db/local_db.py` (added `home_area`, `photo_url`, `phone_verified` columns)

**Pitch line:**
> "We use Firebase phone OTP for identity. Production deployment would
> integrate Bangladesh's Election Commission NID verification API — out of
> scope for the hackathon due to government API registration."

**Verify before demo:**
- Test signup with a real BD number you control.
- The SMS will say "SafeHer verification code" — Firebase's default
  template. Customize the template text in Firebase Console → Authentication → Templates.

---

## 2. Supabase Auth wired up (JWT-based)

**Why:** The previous auth was a custom HMAC token tied to a random
session ID. Real JWT verification makes the demo credible to judges
who actually look at the network tab.

**What changed:**
- Backend `get_current_user` accepts **Supabase JWT (HS256)** OR the
  legacy HMAC token. Whichever the client sends, the right path runs.
- `db/supabase_client.py` now exposes TWO clients:
  - `get_supabase()` — anon key (browser-safe, RLS-restricted)
  - `get_supabase_admin()` — service role key (backend only, RLS-bypassed)
- `routers/circles.py` resolves the owner_id from a JWT *or* the
  X-Session-Id header.
- `frontend/src/lib/api.js` auto-attaches `Authorization: Bearer <jwt>`
  to every authenticated call. The token is read from `localStorage`
  key `safeher.jwt` (Supabase) with a fallback to `safeher.token`
  (legacy HMAC).

**Env vars to add to `.env` and Render:**

```bash
# Already there
SUPABASE_URL=https://yeodkyxfowaqmmugbdmv.supabase.co
SUPABASE_KEY=sb_publishable_T-6SCoxtcecIDyfbDvhpqA_Y0a1o8Wn

# ADD these (Render env vars too)
SUPABASE_SERVICE_KEY=eyJhbGciOi...   # Supabase Dashboard → Settings → API → service_role
SUPABASE_JWT_SECRET=your-project-jwt-secret   # Settings → API → JWT Secret
```

**Verify before demo:**
- Open browser devtools → Network tab → log in → click any protected
  endpoint → confirm `Authorization: Bearer eyJ...` is present.
- Hit `/auth/me` with a stale token → 401 (not 500).
- In Supabase Studio, confirm a row appears in `users` after signup.

---

## 3. Profile photo on the SOS active screen

**Why:** When a trusted contact opens the tracking link, they need to
know **it's really their sister/friend** in under a second. A name in
text is forgettable. A face is not.

**What changed:**
- `features/auth/uploadProfilePhoto.js` uploads the chosen file to
  Firebase Storage at `profile_photos/<uid>/<timestamp>.<ext>` and
  returns a public download URL.
- That URL is stored in `users.photo_url` (SQLite + Supabase).
- When SOS is activated, the **EmergencyContext** pushes the user's
  name, photo, and phone into the same Firebase Realtime DB node as
  the live location (`locations/<sessionId>/profile`).
- The `/track` page reads that profile data on first paint and shows
  a **prominent glass-morphism profile header** above the map:
  circular avatar with a pulsing red ring, the user's full name, and
  their phone number.

**Visual:**
```
┌──────────────────────────────────────────┐
│  ┌──────┐  LIVE LOCATION SHARED BY       │
│  │ 👤   │  Nadia Hossain                  │
│  │      │  +880 1712 345 678             │
│  └──────┘                                │
└──────────────────────────────────────────┘
```

**Verify before demo:**
- Sign up with a photo → press SOS → open the tracking link on another
  device → see your photo and name in the header.
- If no photo is uploaded, the avatar shows the user's initials in the
  brand color.

---

## 4. Home area (context, not verification)

**Why:** Lets us pre-center the map on the user's neighborhood and
seed the chatbot with relevant context ("police stations near Halishahar").
Free text — not a formal address system.

**What changed:**
- `users.home_area TEXT` (SQLite + Supabase).
- Signup form has a new "Home area / neighborhood" field with
  placeholder "e.g. Halishahar, Agrabad".
- `auth_service.create_user` accepts and stores it.
- The `/auth/me` response now returns it (so the frontend can pre-center
  the map and pass it to the chatbot context).

**Future wiring (not in this PR):**
- `MapContainer.jsx` should read `user.home_area`, geocode it, and
  `setView([lat, lng], 13)` on first render.
- `chat_service` should include `user.home_area` in the system prompt
  so the LLM knows the local context.

---

## Supabase SQL — paste this in the SQL editor

```sql
-- (Re-run this; it adds the new columns to your existing schema.)
-- Idempotent: safe to run multiple times.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  email           citext      not null unique,
  phone           text,
  password_hash   text        not null,
  home_area       text,
  photo_url       text,
  phone_verified  boolean     not null default false,
  created_at      timestamptz not null default now()
);

-- Backfill columns for older deployments
alter table public.users add column if not exists home_area       text;
alter table public.users add column if not exists photo_url       text;
alter table public.users add column if not exists phone_verified  boolean not null default false;

create table if not exists public.emergency_contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  phone       text not null,
  email       text,
  relation    text default 'Friend',
  created_at  timestamptz not null default now()
);
create index if not exists idx_emergency_contacts_user
  on public.emergency_contacts(user_id);

create table if not exists public.sos_events (
  id                bigserial primary key,
  session_id        text not null,
  lat               double precision,
  lng               double precision,
  timestamp_ms      bigint,
  trigger_method    text,
  lang_at_trigger   text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_sos_events_session
  on public.sos_events(session_id);

-- Firebase Storage bucket rule (run in Supabase → Storage → Policies):
-- Allow public read on profile_photos/* so the /track page can render
-- the photo without an extra login flow.
```

---

## Local quick-test (5 minutes)

```bash
# 1. Backend
cd /Users/arijitroy/Documents/SafeHer/backend
source venv/bin/activate
uvicorn main:app --reload

# 2. Frontend (separate terminal)
cd /Users/arijitroy/Documents/SafeHer/frontend
npm run dev

# 3. Open http://localhost:5173/signup
#    → fill form
#    → enter a real BD number you control
#    → paste the 6-digit SMS code
#    → (optional) upload a photo
#    → submit → you land on /app/sos

# 4. Press & hold SOS → check your email → click tracking link →
#    you should see your photo and name in the header above the map.
```

---

## What I deliberately did NOT change

- **NID field** — out of scope. Phone OTP is the next best signal.
- **Backend password hashing** — already PBKDF2 with 200k iterations. Solid.
- **EmailJS template** — already in place from the previous round.
- **Mapbox/Leaflet** — left alone. Your existing map setup is fine.
- **Rate limiter** — left alone. Auth routes already have it.

If something on demo day misbehaves, the **most likely culprits** are:
1. `SUPABASE_JWT_SECRET` not set on Render → users get 401s.
2. Firebase Storage bucket not public → profile photos return 403.
3. Recaptcha container div empty / not in DOM when buildRecaptcha is called.
4. `safeher.token` not persisting between localStorage and api.js reads.
