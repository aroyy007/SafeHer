# SafeHer Feature Repair Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Repair SafeHer’s SOS, live tracking, notification, circle, Supabase, and crime-data paths while documenting the project and providing a reproducible Docker backend setup.

**Architecture:** Keep the current SQLite-first local workflow and repair the optional Supabase storage path without introducing Supabase Auth. Make the emergency session ID the shared key across the browser URL, Firebase location/profile node, and backend audit log. Keep the existing CrimeDataBD CSV as the only route-scoring source until provenance is confirmed; scope its KDE points to the graph coverage and document its limits and license.

**Tech Stack:** React 19, Vite, FastAPI, SQLite/aiosqlite, Supabase Python client, Firebase Realtime Database, Docker.

**Spec:** User request in the current chat, the prior source audit, and the attached Bangladesh crime-data notes. User decisions: preserve SQLite locally; repair the optional Supabase path; keep the current incident CSV pending provenance review; edit `/Users/arijitroy/Documents/SafeHer-main` after filesystem approval.

## Global Constraints

- Do not install or run project tests unless the user asks for testing or verification.
- Do not download or merge new incident datasets in this change; retain the current CSV as the source pending provenance/license review.
- Police monthly/division aggregates must not be presented as street-level route or hotspot locations.
- Do not change the user's live deployment or external Firebase/Supabase resources.
- Keep backend runtime pinned to the project’s Python 3.12 target; use Docker for isolation if Python setup is required.

## Review Focus

- Missing/failed browser geolocation must still send SOS and create a log without fabricated coordinates.
- Partial email success must be represented accurately and a failed SMTP fallback must never show as delivered.
- A caller must not use the SMTP fallback to send to addresses outside their stored emergency contacts/circles.
- Supabase-enabled writes must match the schema and must not silently rely on anon RLS behavior.
- Dataset rows outside the Chittagong graph area, missing coordinate values, and source/license uncertainty must not become route-risk evidence.

---

### Task 1: Project instructions and Docker development setup

**Files:**
- Create: `AGENTS.md`
- Modify: `CLAUDE.md`
- Create: `backend/Dockerfile`
- Create: `docker-compose.yml`
- Modify: `.dockerignore`, `.gitignore`, `README.md`

**Interfaces:**
- Produces: a Python 3.12 backend container on port 8000 with SQLite data persisted in a separate named volume and environment configuration supplied through `backend/.env`.

- [x] Document stack, folder map, safe local development commands, environment setup, and test restrictions in `AGENTS.md` and `CLAUDE.md`.
- [x] Build a small Python 3.12 image using `backend/requirements.txt`; keep heavyweight RAG/routing packages opt-in and documented.
- [x] Add a Compose service with backend directory as working directory, health endpoint, `.env` support, and persistent data volume.
- [x] Update repository ignores for runtime database, cache, ChromaDB, and Docker build artifacts.
- [x] Document that Docker is optional and that Render's Lite Mode intentionally omits route graph loading.

### Task 2: End-to-end SOS session and truthful status

**Files:**
- Modify: `frontend/src/contexts/EmergencyContext.jsx`
- Modify: `frontend/src/features/tracking/LocationTracker.jsx`
- Modify: `frontend/src/features/tracking/firebaseClient.js`
- Modify: `frontend/src/pages/Track/Track.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/AppShell/AppShell.jsx`
- Modify: `frontend/src/features/sos/DisguiseMode.jsx`
- Modify: `frontend/src/features/sos/VoiceTrigger.jsx`
- Modify: `frontend/src/features/sos/SosManager.jsx`
- Modify: `frontend/src/lib/api.js`
- Modify: `backend/routers/sos.py`
- Modify: `backend/services/sos_service.py`
- Modify: `backend/db/local_db.py`
- Modify: `backend/supabase_schema.sql`

**Interfaces:**
- Produces: `activateSOS(triggerMethod)` accepts `button_hold`, `voice_command`, or `disguise_mode`; `EmergencyContext` exposes `emergencySessionId` and a delivery status; location/profile writes and `/track/:sessionId` use the same session node.

- [x] Generate a fresh opaque ID for each SOS and construct `/track/<sessionId>` links.
- [x] Pass the active ID into the background location tracker and calculator disguise flow; write location and profile beneath the same Firebase node.
- [x] Call `/sos/log` once per activation, carrying valid location only when the browser provides it and never turning a logging failure into failed SOS delivery.
- [x] Align `sos_service.py` with the supplied `sos_logs` table and store millisecond timestamps in the existing table fields/payload.
- [x] Track per-recipient delivery outcomes and show sent, partial, failed, or no-recipient status accurately.
- [x] Preserve the emergency flow if geolocation, Firebase, or the backend is unavailable.

### Task 3: SMTP authorization and Trusted Circles delivery

**Files:**
- Modify: `backend/routers/sos.py`
- Modify: `backend/routers/circles.py`
- Modify: `backend/routers/auth.py`
- Modify: `backend/services/sos_alert_service.py`
- Modify: `backend/core/rate_limiter.py`
- Modify: `backend/services/circles_service.py`
- Modify: `backend/services/auth_service.py`
- Modify: `frontend/src/contexts/EmergencyContext.jsx`
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/pages/Circles/Circles.jsx`

**Interfaces:**
- Produces: an authenticated recipient lookup for the current user combining saved emergency contacts and circle members; `/sos/alert` accepts only the authenticated user's stored email recipients.

- [x] Require valid SafeHer bearer authentication on `/sos/alert` and apply a per-user/IP send limit.
- [x] Resolve authorized email recipients from the caller's emergency contacts and circles; reject arbitrary addresses and oversized duplicate batches.
- [x] HTML-escape interpolated email text and validate tracking URLs against configured frontend origins.
- [x] Return aggregate SMTP delivery counts, batch failed EmailJS recipients once within the endpoint cap, and report the actual combined outcome.
- [x] Include circle members in the SOS recipient set and clarify member contact format in the UI.

### Task 4: Make the optional Supabase path consistent

**Files:**
- Modify: `backend/db/supabase_client.py`
- Modify: `backend/services/auth_service.py`
- Modify: `backend/services/incident_service.py`
- Modify: `backend/services/sos_service.py`
- Modify: `backend/services/circles_service.py`
- Modify: `backend/supabase_schema.sql`
- Modify: `INTEGRATIONS_SETUP.md`, `README.md`

**Interfaces:**
- Produces: backend services use a server-side service-role Supabase client after application authentication and perform explicit ownership checks; Supabase schema includes the columns/RPCs used by services and mirrors SafeHer profile IDs needed by foreign keys.

- [x] Align the idempotent canonical schema with service calls, add `get_incidents_within`, and avoid incompatible parallel table names; preserve existing rows.
- [x] Write SOS rows to `sos_logs`; align incident inserts with schema fields and use a stable salted hash or omit client IP metadata.
- [x] Use the service-role client only on the backend, with explicit owner filters for circles and contacts.
- [x] Upsert SafeHer profile identity rows when local SQLite auth is used with Supabase so table foreign keys can be satisfied.
- [x] Document that this is SafeHer application authentication plus Supabase storage, not Supabase Auth, and clarify required service-role configuration.

### Task 5: Scope and document the existing CrimeDataBD source

**Files:**
- Modify: `backend/precompute/build_graph.py`
- Modify: `backend/data/README.md`
- Modify: `datasets.md`
- Modify: `README.md`

**Interfaces:**
- Produces: KDE training points are limited to valid coordinates within the Chittagong graph radius; documentation states the current dataset lacks victim gender and year, contains approximate news-reported coordinates, and is CC BY-NC 4.0.

- [x] Validate required coordinate columns and finite numeric values; report usable and rejected row counts without printing incident content.
- [x] Filter training records to the configured 5 km graph region before fitting KDE.
- [x] Remove claims that the dataset is female-victim-filtered, year-resolved, or a verified measure of women's safety.
- [x] Explain that official police aggregates are a separate trend data layer and must not be projected onto streets.
- [x] Record Mendeley attribution, dataset version, noncommercial license, duplicate-copy note, and outstanding provenance/coordinate-confidence limits.

### Task 6: Final source consistency review

**Files:**
- Review all modified frontend/backend/config/data documentation.

- [x] Check every changed contract across browser, API, Firebase, SQLite, Supabase schema, and docs.
- [x] Check Docker configuration and environment names by static inspection; do not install dependencies or run tests/builds.
- [x] Report any runtime verification that remains outstanding and identify external-service configuration still required.

### Task 7: Expire and clean up SOS tracking sessions

**Spec:** [`../specs/2026-11-04-tracking-session-expiry.md`](../specs/2026-11-04-tracking-session-expiry.md)

- [x] Store an immutable creation and 24-hour expiry timestamp with every profile/location write; stop browser location updates at expiry.
- [x] Hide location/profile at the expiry deadline and show an explicit expired-link state.
- [x] Add indexed RTDB rules for active reads, bounded session creation, and immutable expiry; retain legacy read/cleanup compatibility.
- [x] Add an hourly Firebase Function to delete expired and legacy location nodes without logging their contents.
- [x] Document deployment, Node runtime, billing requirement, cleanup delay, and the fact that live Firebase remains untouched.
- [x] Static review of all changed contracts; no tests, build, emulator, or deployment run.

### Task 8: Replace demo heatmap with aggregated CrimeDataBD counts

**Spec:** [`../specs/2026-11-04-crime-heatmap-data.md`](../specs/2026-11-04-crime-heatmap-data.md)

- [x] Retire the three hard-coded demo hotspots and use the canonical CSV in the `/heatmap/` API.
- [x] Filter to valid Bangladesh coordinates within the shared 5 km Chattogram graph coverage.
- [x] Aggregate before returning data into approximate ~1 km cells; return counts and relative density, without individual descriptions/points.
- [x] Update the map tooltip, legend, landing copy, and API/data docs to avoid risk percentages and false coverage claims.
- [x] Static review of data contract and UI; no tests, builds, or graph precomputation run.

### Task 9: Improve Banglish chat transliteration with `avro.py`

**Spec:** [`../specs/2026-11-04-banglish-transliteration.md`](../specs/2026-11-04-banglish-transliteration.md)

**Files:** `backend/requirements.txt`, `backend/language/transliterator.py`, `README.md`

- [x] Pin `avro.py==2025.11.3` in the default Python 3.12 backend requirements.
- [x] Replace character-wise conversion with `avro.parse` behind the existing transliterator function signatures.
- [x] Preserve URLs, emails, numbers, acronyms, Bengali spans, and the current mixed-script English allowlist.
- [x] Clear the package's raw-input LRU cache after every parse, including exception paths.
- [x] Document the local parser, license, ambiguity limits, and dependency namespace caveat.
- [x] Static source review only; no tests, build, dependency install, or Docker startup run.
