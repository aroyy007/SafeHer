# SafeHer project guide

## Purpose

SafeHer is a Bengali-first safety web application for Bangladesh. It contains a React/Vite frontend and FastAPI backend. Treat SOS, location sharing, emergency contact data, and route-safety claims as safety-sensitive behavior.

## Stack and entry points

- Frontend: React 19, Vite 8, React Router 7; `frontend/src/main.jsx` and `frontend/src/App.jsx`.
- Backend: Python 3.12+, FastAPI; `backend/main.py`.
- Local persistence: SQLite via `backend/db/local_db.py` (`SAFEHER_DB_PATH` can override the default).
- Optional storage: Supabase via `backend/db/supabase_client.py`; server-side writes require `SUPABASE_SERVICE_KEY`.
- Live location/profile: Firebase Realtime Database via `frontend/src/features/tracking/firebaseClient.js`.
- SOS email: EmailJS in the browser, with an optional authenticated SMTP fallback.
- Route graph: generated Chittagong OpenStreetMap walk graph; this is a heuristic, city-limited estimate.

## Directory map

- `frontend/src/pages/`: landing, app shell, auth, circles, and tracking screens.
- `frontend/src/features/`: SOS, map, chat, profile upload, and tracking behavior.
- `frontend/src/contexts/`: authentication and emergency state.
- `backend/routers/`: HTTP request validation and API route handlers.
- `backend/services/`: authentication, alert delivery, persistence, chat, and routing logic.
- `backend/db/`: SQLite and Supabase adapters.
- `backend/routing/`, `backend/rag/`, `backend/language/`: algorithms and processing modules.
- `backend/precompute/`: graph and knowledge-base generation.
- `backend/data/`: runtime database, generated data, and the canonical `crimedatabd.csv` input.
- `skills/` and `.claude/skills/`: vendored agent skills; check attribution/licensing before redistribution.

## Data and safety rules

- The checked-in CrimeDataBD records are news-derived and have approximate coordinates. They have no year or victim-gender field. Do not describe them as female-victim-filtered, current, or verified reports of street-level risk.
- CrimeDataBD is licensed CC BY-NC 4.0. Preserve attribution and do not use it in a commercial product without confirming compatible rights.
- Keep monthly police statistics at their published administrative/time resolution; do not assign them street coordinates.
- Describe routing as a heuristic estimate, never as a guarantee of safety.
- A single SOS session ID must connect its tracking URL, Firebase location/profile node, and backend audit event.
- Firebase tracking sessions expire 24 hours after SOS activation; the tracking UI and RTDB rules stop serving them at expiry, and the optional scheduled Function physically deletes them hourly.
- Do not log names, phone numbers, email addresses, exact coordinates, auth tokens, or tracking URLs unless essential; redact them from diagnostics.
- Never send SMTP alerts to recipients that are not stored for the authenticated user.
- Keep secrets out of source control. Use `.env` files locally and deployment secret stores remotely.

## Implementation conventions

- Keep FastAPI routers thin; put persistence/business logic in `backend/services/` and adapters in `backend/db/`.
- Validate request payloads with Pydantic and return generic client errors without leaking exception details.
- Use parameterized SQL in SQLite and explicit owner filters for every circle/contact query.
- Keep heavy RAG/routing imports lazy so Lite Mode can start on memory-limited hosts.
- React components use function components and hooks. Keep API calls in `frontend/src/lib/api.js` where practical.
- Update `API_DOCUMENTATION.md`, `README.md`, and integration instructions when public API or runtime setup changes.
- Keep generated databases, caches, graph files, Chroma stores, and credentials out of version control.

## Local development

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Backend with Docker:

```bash
docker compose up --build
```

The default Compose service uses SQLite and Lite Mode. The SQLite file lives in a separate persistent volume so the source CSV under `backend/data/` remains visible. Routing requires the optional graph dependencies and a generated `backend/data/chittagong_walk.graphml`; full RAG requires the optional packages and model assets. See `backend/data/README.md` and `BACKEND_DEPLOY.md`.

## Verification

- Do not claim tests, lint, builds, container startup, migrations, or external integrations passed unless the corresponding command/service was actually run and its output inspected.
- Before changing a safety-critical workflow, trace the full browser → API/provider → persistence → recipient path.
- For any migration, keep schema additions additive and document how operators apply them.
- Avoid editing the vendored skills unless the task is explicitly about those skills.
