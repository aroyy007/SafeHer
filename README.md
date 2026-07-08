# SafeHer

> A Bengali-voice-activated women's safety web app for Bangladesh — **no install required**.

[![Status](https://img.shields.io/badge/status-hackathon--ready-ff4d6d)]()
[![Frontend](https://img.shields.io/badge/frontend-React_19-61dafb)]()
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688)]()
[![Map](https://img.shields.io/badge/map-Mapbox_GL-1a1a1a)]()

SafeHer is a website — not a native app — built so a woman can open it on her phone in an unsafe moment and instantly alert family, share live location, find the safest walking route, and ask an AI assistant questions. The app is **Bengali-first** with a voice SOS trigger (`বাঁচাও`), a **calculator disguise mode** for stealth, and **safe-route scoring** built on 6,574 real Bangladesh crime records.

---

## Table of contents

- [Why SafeHer?](#why-safeher)
- [Features](#features)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [The data layer](#the-data-layer)
- [Development workflow](#development-workflow)
- [Deployment](#deployment)
- [Testing](#testing)
- [Performance budgets](#performance-budgets)
- [Security & privacy](#security--privacy)
- [Limitations & known issues](#limitations--known-issues)
- [License](#license)

---

## Why SafeHer?

| | |
|---|---|
| **7,028** | Violence-against-women cases reported in Bangladesh in the first 4 months of 2025 |
| **6,574** | Crime records from `CrimeDataBD` driving our route safety scoring |
| **90%** | Women reporting harassment on Dhaka public transit |
| **2-3%** | Conviction rate for reported violence cases |

The judges at CUET SciBlitz recognize the problem instantly. The job of SafeHer is to give them a working, demoable solution in under 90 seconds of presentation time.

---

## Features

### 1. SOS — three ways to trigger

| Trigger | Latency | Description |
|---|---|---|
| **Button hold** (3 s) | ~3 s | The signature red button on `/app/sos` |
| **Voice command** (`বাঁচাও`) | ~0.8 s | Bengali voice activation via Web Speech API |
| **Calculator disguise** | ~1 s | Triple-tap header swaps the UI to a calculator; long-press `=` fires SOS |

Each trigger (a) logs an audit trail server-side, (b) sends personalized emails to your trusted circle via EmailJS (one email per contact, each with the recipient's name + a unique live-tracking link), and (c) starts a Firebase-backed live-location share session that pushes the user's profile photo + name into the same RTDB node so trusted contacts see **"It's really Nadia"** alongside the map.

### 2. Live location share — no install required for family

When SOS fires, the recipient gets a short link like `https://safeher.app/track/abc123`. Anyone with the link sees a Leaflet/OSM map with a pulsing marker, a **prominent profile header** (circular photo + full name + phone with a red pulsing ring), a "live / stale / offline" banner, and one-tap call buttons for **999** (National Emergency) and **10921** (Women & Child Helpline). The session lives in Firebase Realtime Database — no app, no sign-up, no friction.

### 3. Safe routing — A* + SafetiPin scoring

For every route request, the backend runs two algorithms on a precomputed OpenStreetMap walk graph:

- **Safe route** — A* weighted by `safety_cost = length × (2 − safety)`
- **Fast route** — Dijkstra weighted by `length` only

Edge safety is the SafetiPin-inspired composite:
```
safety = 0.35 × lighting_score
       + 0.40 × incident_density_score    ← KDE over CrimeDataBD
       + 0.25 × road_type_score           ← footway > residential > trunk
```
The frontend renders both as Mapbox line layers (emerald solid = safe, amber dashed = fast).

### 4. Bilingual AI assistant (RAG)

- **Detects** Bengali / Banglish / code-mixed / English input
- **Transliterates** Banglish → Bengali (Avro-style phonetic map, 70+ keywords)
- **Normalizes** Unicode with `csebuetnlp/normalizer` (graceful fallback)
- **Embeds** with `l3cube-pune/bengali-sentence-similarity-sbert`
- **Retrieves** from a 60+ entry ChromaDB KB across 14 safety categories
- **Generates** with Gemini 2.5 Flash (default) or Groq `llama-3.3-70b-versatile` (one-line `.env` switch)

Strict guardrails: **never hallucinates** phone numbers. If retrieval returns nothing, the response is the hard-coded `EMERGENCY_FALLBACK` (999 / 10921).

### 5. Trusted Circles (JWT-authenticated)

Per-user circle CRUD (family, friends, roommates) backed by SQLite (dev) or Supabase (prod). Each circle has members with name + contact + relation. Auth is **dual-mode**: Supabase JWT (HS256) in production, legacy HMAC token for hackathon dev. Used to dispatch SOS alerts.

### 6. Auth — phone OTP + email/password

Three-step signup flow:
1. **Basic info** — name, email, phone, password, home area
2. **Firebase phone OTP** via invisible reCAPTCHA (SMS verification)
3. **Profile photo upload** to Firebase Storage

Identity is anchored to a real BD phone number — no fake NID field. (Production deployment would integrate Bangladesh's Election Commission NID API; out of scope for the hackathon.) The user row stores `home_area` (used for map centering + chatbot context), `photo_url` (rendered on `/track`), and `phone_verified` (set after Firebase OTP succeeds).

### 7. Geocoding

Free-text place names ("GEC Circle", "2 No Gate") resolve to lat/lng via OpenStreetMap Nominatim with a Bangladesh viewbox and 1.05 s throttle (Nominatim TOS compliance).

### 8. Community incident reporting

Anonymous submission of unsafe-area reports (8 categories, 4 time-of-day buckets). Powers a heatmap layer on the map. Capped at 10 reports / hour / session via sliding-window rate limiter.

---

## Architecture

```
                        ┌─────────────────────────────────────────┐
                        │            Browser (React 19)           │
                        │                                          │
   ┌────────────────────┤  Landing  →  AppShell  →  Track/:id      │
   │  SOS button        │     │           │   │   │   │             │
   │  Voice trigger     │     ▼           ▼   ▼   ▼   ▼             │
   │  Calculator mode   │   Hero       SOS Map Chat You   Share map  │
   └────────────────────┤     │           │   │   │                  │
                        │     └───┬───────┴───┴───┴──────┬───────┘  │
                        └─────────┼─────────────────────┼──────────┘
                                  │                     │
                  ┌───────────────┼──────────────┐      │
                  │               │              │      │
                  ▼               ▼              ▼      ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  FastAPI     │  │  Firebase    │  │  EmailJS     │
        │  backend     │  │  RTDB        │  │  (SOS mail)  │
        │              │  │              │  │              │
        │ • /chat  RAG │  │ locations/   │  │ serviceID    │
        │ • /route     │  │ <sessionId>  │  │ templateID   │
        │ • /incidents │  │   lat,lng,   │  │              │
        │ • /sos/log   │  │   timestamp  │  │              │
        │ • /circles   │  └──────────────┘  └──────────────┘
        │ • /geocode   │
        │ • /heatmap   │
        └──────┬───────┘
               │
   ┌───────────┼───────────────┬────────────────┐
   │           │               │                │
   ▼           ▼               ▼                ▼
 SQLite     ChromaDB      Nominatim        Mapbox GL JS
 incidents  60+ entries   /search          dark-v11
 circles    Bengali SBERT   1 RPS throttle
 sos_logs   embeddings    BD viewbox
```

### Why this stack

- **Frontend is a website (no install)** — install takes storage, time, and trust. A URL opens in 2 seconds.
- **FastAPI** is async-first, has built-in OpenAPI docs, and runs A* pathfinding in a thread pool without blocking.
- **ChromaDB** is local-first; no managed-vector-DB bill to worry about during the hackathon.
- **SQLite fallback** means the demo works even with zero external service credentials.

---

## Repository layout

```
SafeHer/
├── README.md                         ← you are here
├── API_DOCUMENTATION.md              ← full HTTP API reference
├── Problem.md                        ← problem framing + Bangladesh context
├── datasets.md                       ← dataset inventory + sources
├── SafeHer_Backend_System_Design.md  ← original design document
│
├── backend/                          ← Python 3.11+ / FastAPI
│   ├── main.py                       ← entry point
│   ├── requirements.txt
│   ├── .env / .env.example
│   ├── core/
│   │   ├── config.py                 ← Pydantic settings
│   │   ├── exceptions.py             ← global error handlers
│   │   └── rate_limiter.py           ← sliding-window per-session
│   ├── routers/
│   │   ├── chat.py                   ← /chat         (RAG)
│   │   ├── route.py                  ← /route        (A* + Dijkstra)
│   │   ├── incidents.py              ← /incidents    (CRUD)
│   │   ├── sos.py                    ← /sos/log      (audit trail)
│   │   ├── geocode.py                ← /geocode      (Nominatim)
│   │   ├── circles.py                ← /circles      (Trusted Circles CRUD)
│   │   └── health.py                 ← /health + /heatmap
│   ├── services/
│   │   ├── chat_service.py           ← Gemini / Groq with auto-fallback
│   │   ├── routing_service.py        ← executor-wrapped A* / Dijkstra
│   │   ├── incident_service.py
│   │   ├── sos_service.py
│   │   └── circles_service.py
│   ├── routing/
│   │   ├── graph_loader.py           ← .graphml singleton
│   │   ├── pathfinder.py             ← A* safe + Dijkstra fast
│   │   ├── safety_scorer.py          ← SafetiPin weights
│   │   └── geojson_builder.py
│   ├── rag/
│   │   ├── embeddings.py             ← Bengali SBERT + MiniLM fallback
│   │   ├── knowledge_base.py         ← ChromaDB PersistentClient
│   │   ├── retriever.py              ← standard + emergency fast-path
│   │   └── seed_data.py              ← 60+ bilingual entries
│   ├── language/
│   │   ├── preprocessor.py           ← detect → transliterate → normalize
│   │   ├── detector.py               ← 70+ Banglish keywords
│   │   ├── transliterator.py         ← Avro phonetic map
│   │   └── normalizer.py             ← csebuetnlp wrapper
│   ├── db/
│   │   ├── local_db.py               ← SQLite fallback (users, contacts, sos_logs, circles)
│   │   └── supabase_client.py        ← anon + service-role clients + JWT verify
│   ├── precompute/
│   │   ├── build_graph.py            ← OSM download + KDE scoring
│   │   ├── seed_incidents.py
│   │   └── build_knowledge_base.py
│   ├── scripts/
│   │   └── build_all.py              ← one-shot build runner
│   └── data/                         ← runtime + build artifacts (see data/README.md)
│
└── frontend/                         ← React 19 / Vite 8
    ├── package.json
    ├── .env.example
    ├── index.html                    ← title, theme-color, Bengali meta
    ├── vite.config.js
    └── src/
        ├── main.jsx                  ← BrowserRouter
        ├── App.jsx                   ← Routes: /, /app/:tab, /track/:id
        ├── pages/
        │   ├── Landing/              ← marketing
        │   ├── AppShell/             ← in-app shell + bottom nav
        │   ├── Auth/                 ← Login + 3-step Signup
        │   ├── Circles/              ← Trusted Circles UI
        │   └── Track/                ← public tracking map (with profile header)
        ├── features/
        │   ├── sos/                  ← SOS button + disguise
        │   ├── chat/                 ← SafetyChat component
        │   ├── map/                  ← MapContainer + routing
        │   ├── auth/                 ← firebasePhoneAuth, uploadProfilePhoto
        │   └── tracking/             ← Firebase subscribe + push helpers
        ├── components/ui/            ← Button, IconButton
        ├── contexts/                 ← AuthProvider, EmergencyProvider
        ├── lib/                      ← api.js (with Bearer token), useMapbox.js
        ├── utils/                    ← voice trigger, language helpers
        └── styles/                   ← theme.css, index.css
```

### Documentation

| File | Purpose |
|---|---|
| `README.md` | This file — top-level overview |
| `API_DOCUMENTATION.md` | Full HTTP API reference |
| `INTEGRATIONS_SETUP.md` | Step-by-step setup for Firebase, Supabase, EmailJS, Groq, Gemini |
| `PRE_DEMO_CHANGES.md` | Audit log of the pre-demo hardening pass (auth, JWT, photo, home_area) |
| `DEPLOYMENT.md` | Production deployment guide for Render / Vercel / Netlify / Railway / Fly.io |
| `BACKEND_DEPLOY.md` | Backend-specific deploy guide (Render / Railway / HuggingFace Space), `LITE_MODE` flag, SMTP fallback |
| `FIREBASE_SETUP.md` | Step-by-step for enabling Firebase Phone Auth (fixes `auth/configuration-not-found`) |
| `Problem.md` | Problem framing + Bangladesh context |
| `datasets.md` | Dataset inventory + sources |
| `SafeHer_Backend_System_Design.md` | Original system design document |
| `CLAUDE.md` | Handoff notes for AI agents |

---

## Quick start

### Prerequisites

| | Version | Notes |
|---|---|---|
| Python | 3.11+ | tested on 3.12 |
| Node.js | 20+ | Vite 8 requirement |
| npm | 10+ | |
| ~500 MB disk | | for OSM graph + sentence-transformers |
| Optional: API keys | | see [Configuration](#configuration) |

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# One-time precomputation (~5-15 min)
python scripts/build_all.py
# OR step by step:
python precompute/build_graph.py

# Start dev server
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for the auto-generated Swagger UI.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local        # fill in Mapbox token at minimum
npm run dev
```

Visit `http://localhost:5173`.

### 3. Verify

```bash
# Backend health
curl http://localhost:8000/health
# Expected: { "status": "ok", "graph": { "loaded": true, ... }, ... }

# Frontend builds for production
cd frontend && npm run build
# Expected: ✓ built in <1s, dist/ populated
```

---

## Configuration

### Backend `.env`

| Key | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini` or `groq` |
| `GEMINI_API_KEY` | _empty_ | Required for `gemini` provider |
| `GROQ_API_KEY` | _empty_ | Required for `groq` provider |
| `HUGGINGFACE_API_KEY` | _empty_ | Embedding model downloads |
| `USE_SUPABASE` | `false` | Switch incident/circle storage to PostGIS |
| `SUPABASE_URL` | _empty_ | Supabase project URL |
| `SUPABASE_KEY` | _empty_ | **Publishable / anon key** (browser-safe; RLS-restricted) |
| `SUPABASE_SERVICE_KEY` | _empty_ | **Service role key** (backend only, bypasses RLS). Falls back to `SUPABASE_KEY` if unset. |
| `SUPABASE_JWT_SECRET` | _empty_ | HS256 secret for verifying frontend access tokens. Supabase → Settings → API → JWT Secret. |
| `USE_FIREBASE` | `false` | Switch SOS event storage |
| `FIREBASE_CREDENTIALS_BASE64` | _empty_ | base64 service-account JSON |
| `HOST` | `0.0.0.0` | |
| `PORT` | `8000` | |
| `ALLOWED_ORIGINS` | _empty_ | Comma-separated CORS allow-list. Empty → dev defaults |
| `ENABLE_BENGALI_EMBEDDER` | `true` | Use l3cube Bengali SBERT |
| `GRAPH_PATH` | `data/chittagong_walk.graphml` | |
| `CHROMA_PATH` | `./chroma_store` | |
| `MAX_INCIDENTS_PER_HOUR` | `10` | Rate-limit cap |
| `MAX_CHAT_QUERY_LENGTH` | `1000` | |
| `MAX_NEARBY_RADIUS_M` | `5000` | |
| `BD_LAT_MIN/MAX` | `20.5 / 26.7` | Bangladesh bounding box |
| `BD_LNG_MIN/MAX` | `88.0 / 92.7` | |

### Frontend `.env.local`

| Key | Required? | Purpose |
|---|---|---|
| `VITE_API_URL` | recommended | FastAPI base URL. Default `http://localhost:8000` |
| `VITE_MAPBOX_TOKEN` | yes for maps | Public Mapbox token |
| `VITE_FIREBASE_API_KEY` | yes for tracking | |
| `VITE_FIREBASE_AUTH_DOMAIN` | | |
| `VITE_FIREBASE_DATABASE_URL` | | RTDB URL |
| `VITE_FIREBASE_PROJECT_ID` | | |
| `VITE_FIREBASE_STORAGE_BUCKET` | | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | | |
| `VITE_FIREBASE_APP_ID` | | |
| `VITE_EMAILJS_SERVICE_ID` | yes for SOS mail | |
| `VITE_EMAILJS_TEMPLATE_ID` | | |
| `VITE_EMAILJS_PUBLIC_KEY` | | |

If any Mapbox/Firebase value is missing, the UI shows a clean empty state instead of crashing.

---

## The data layer

| File | What | Source | Used by |
|---|---|---|---|
| `data/crimedatabd.csv` | 6,574 Bangladesh crime records | Mendeley Data | Safety scoring (KDE) |
| `data/chittagong_walk.graphml` | ~25 MB scored walk graph | `precompute/build_graph.py` | `/route` |
| `data/chittagong_incidents.geojson` | Curated hotspot pins | Manual + community reports | `/heatmap` |
| `data/safeher_local.db` | SQLite (incidents, circles, sos_logs) | `db/local_db.init_db()` | All write endpoints |
| `chroma_store/` | ChromaDB persistent dir | `rag/knowledge_base.seed_if_empty()` | `/chat` RAG |

### Re-seeding the knowledge base

The KB seeds itself on first boot with 60+ bilingual safety entries across 14 categories. To force a re-seed:

```bash
rm -rf chroma_store/
python precompute/build_knowledge_base.py
```

See `backend/data/README.md` for the full build pipeline.

---

## Development workflow

### Hot reload

```bash
# Terminal 1 — backend
cd backend && uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

### Linting

```bash
cd frontend
npm run lint                    # oxlint, fast
```

### Code style

- Python: PEP 8 + type hints on public functions
- JSX: function components, hooks, no class components
- Both: explicit imports (no `import *`)
- Comments in docstring form for non-obvious logic only

### Adding a new safety KB entry

1. Open `backend/rag/seed_data.py`
2. Append an entry to the matching category list:

   ```python
   {
       "id": "kb_<category>_<slug>",
       "category": "<category>",
       "lang": "bn",          # or "en"
       "text": "বাংলা নিরাপত্তা তথ্য ...",
       "source": "BNWC hotline"
   }
   ```
3. Delete `chroma_store/` to force re-seed on next boot
4. Test: `curl -X POST http://localhost:8000/chat/?query=...`

### Adding a new endpoint

1. Create or modify a file under `backend/routers/`
2. Define a Pydantic model for the request body
3. Wire the service layer in `backend/services/`
4. Mount the router in `backend/main.py`
5. Document in `API_DOCUMENTATION.md`
6. Add a helper in `frontend/src/lib/api.js`

---

## Deployment

The full deployment guide — including how to deploy to Render + Vercel,
Railway + Netlify, Fly.io, and how to keep the free tier awake during
your demo — lives in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

TL;DR for the SciBlitz demo:

| Layer | Recommended host | Why |
|---|---|---|
| Backend | **Render** free Web Service | FastAPI-ready, free tier, .env support |
| Frontend | **Netlify** or **Vercel** | Both work. Netlify is free-tier gentler; Vercel has cleaner Vite support |
| Keep-alive | `cron-job.org` hitting `/health` every 14 min | Defeats Render's 15-min sleep |

**Critical pre-deploy step**: pre-build `chroma_store/` and `data/chittagong_walk.graphml` on your local machine and commit them. Otherwise Render's 512 MB RAM can't load the 500 MB Bengali SBERT model on first boot.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full step-by-step.

---

## Testing

The project is currently shipping without an automated test framework — the team prioritized a working demo over test coverage. Recommended setup before scaling:

```bash
# Backend
pip install pytest pytest-asyncio httpx
pytest backend/tests/

# Frontend
npm install -D vitest @testing-library/react
npm test
```

Manual smoke tests:

```bash
# Chat
curl -X POST http://localhost:8000/chat/?query=hello

# Geocode
curl 'http://localhost:8000/geocode/?name=GEC%20Circle'

# Health
curl http://localhost:8000/health

# Trusted Circles (requires X-Session-Id header)
curl -X POST http://localhost:8000/circles/ \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: dev-test-session-id-1234' \
  -d '{"name":"Family"}'
```

---

## Performance budgets

| Metric | Budget | Notes |
|---|---|---|
| `/chat` cold start | < 2.5 s | Embedding + retrieval + Gemini call |
| `/chat` warm | < 1.2 s | |
| `/route` | < 1.5 s | A* on Chittagong walk graph |
| `/geocode` | < 1.5 s | throttled to 1 RPS upstream |
| Frontend JS bundle | < 700 KB gzipped | currently ~626 KB gzipped |
| Lighthouse performance | ≥ 90 | Landing page on mid-tier mobile |
| Time to interactive (landing) | < 2.5 s | 4G connection |

---

## Security & privacy

- **Auth is JWT-bound** — every protected endpoint accepts a Supabase HS256 JWT (production) or a legacy SafeHer HMAC token (dev). The frontend attaches the JWT as `Authorization: Bearer <token>` automatically; the backend verifies the signature against `SUPABASE_JWT_SECRET` with no network round-trip.
- **Trusted Circle membership is ownership-checked** — no cross-owner reads
- **Passwords hashed** with PBKDF2-HMAC-SHA256, 200k iterations, 16-byte random salt per user. Legacy SHA-256 hashes are auto-upgraded on login.
- **Disposable email domains blocked** at signup (mailinator, tempmail, etc.)
- **No raw 500s** — every endpoint either returns data or a safe fallback
- **Bangla/Banglish transliteration runs locally** — no third-party translation calls
- **SOS alerts go through EmailJS** (no backend logging of recipient addresses)
- **Rate-limited** by IP for auth routes, by session for incidents
- **Firebase Storage rules** (you must set these yourself): allow public read on `profile_photos/*`, require auth on write
- **Firebase RTDB rules** (you must set these yourself): lock `/locations/<uid>` writes to authenticated sessions

For a production deployment beyond the hackathon, add:
- PostGIS row-level security on Supabase (RLS is on by default — write policies for `sos_events`)
- Rate limiting middleware on a shared store (currently per-process; use Redis for multi-instance)
- HTTPS-only cookies and CSP headers
- PII-stripping on chat queries before embedding

---

## Limitations & known issues

1. **Graph is Chittagong-only.** The `precompute/build_graph.py` script is hard-coded to a 5 km radius around `22.3569, 91.7832`. Add other cities by extending the script.
2. **Single-process rate limiter.** Multiple Uvicorn workers won't share the limiter. Use Redis for production.
3. **Nominatim 1 RPS throttle** means ~60 place-lookups / minute / process. For high traffic, switch to Mapbox Geocoding.
4. **Bengali SBERT model is ~500 MB.** First boot downloads it from HuggingFace. **Mitigation**: pre-build `chroma_store/` locally and commit it so the running process never has to download the model. Set `ENABLE_BENGALI_EMBEDDER=false` to fall back to the 80 MB `all-MiniLM-L6-v2` (lower Bengali quality).
5. **Render free tier sleeps after 15 min.** Set up a cron job on `cron-job.org` to ping `/health` every 14 minutes during the demo window — the endpoint already reports `graph.loaded` and `knowledge_base.document_count` so a green response is a real readiness signal.
6. **NID verification is out of scope.** Bangladesh's Election Commission NID API requires government registration. We use Firebase phone OTP instead, which judges accepted as a credible identity signal — see the pitch in `DEPLOYMENT.md`.

---

## Acknowledgments

- **CrimeDataBD** — Bangladesh crime records dataset (Mendeley)
- **SafetiPin** safety framework — Viswanath & Basu (2015)
- **l3cube-pune/bengali-sentence-similarity-sbert** — Bengali SBERT model
- **csebuetnlp/normalizer** — Bengali text normalization
- **OpenStreetMap** + **Nominatim** — free geodata and geocoding
- **Mapbox** for the dark map style

Built at **CUET SciBlitz 2026**.

---

## License

This project is released under the MIT License. See `LICENSE` for details.