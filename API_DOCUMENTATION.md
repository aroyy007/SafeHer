# SafeHer API Documentation

> HTTP API reference for the SafeHer backend.
> Base URL (dev): `http://localhost:8000`
> Base URL (prod): `https://safeher-api.onrender.com`
> Interactive docs: `<base_url>/docs` (Swagger UI) · `<base_url>/redoc` (ReDoc)

---

## Table of contents

- [Conventions](#conventions)
- [Authentication](#authentication)
- [Rate limiting](#rate-limiting)
- [Error handling](#error-handling)
- [Endpoints](#endpoints)
  - [GET `/`](#get-)
  - [GET `/health`](#get-health)
  - [POST `/chat/`](#post-chat)
  - [GET `/route/`](#get-route)
  - [GET `/geocode/`](#get-geocode)
  - [POST `/incidents/`](#post-incidents)
  - [GET `/incidents/nearby`](#get-incidentsnearby)
  - [POST `/sos/log`](#post-soslog)
  - [GET `/heatmap/`](#get-heatmap)
  - [Authentication endpoints](#authentication-1)
    - [`POST /auth/signup`](#post-authsignup)
    - [`POST /auth/login`](#post-authlogin)
    - [`GET /auth/me`](#get-authme)
    - [`POST /auth/contacts`](#post-authcontacts)
    - [`DELETE /auth/contacts/{contact_id}`](#delete-authcontactscontact_id)
  - [Trusted Circles](#trusted-circles)
    - [POST `/circles/`](#post-circles)
    - [GET `/circles/`](#get-circles)
    - [GET `/circles/{id}`](#get-circlesid)
    - [DELETE `/circles/{id}`](#delete-circlesid)
    - [POST `/circles/{id}/members`](#post-circlesidmembers)
    - [DELETE `/circles/{id}/members/{member_id}`](#delete-circlesidmembersmember_id)
- [Webhooks](#webhooks)
- [Changelog](#changelog)

---

## Conventions

- **Content type**: All request and response bodies are `application/json` unless noted otherwise.
- **Timestamps**: Unix milliseconds (integer).
- **Coordinates**: Decimal degrees in WGS84. Order is `[lng, lat]` in GeoJSON responses.
- **Field naming**: snake_case throughout.
- **Pagination**: None — every list endpoint returns the full result set (acceptable for the current scale).
- **Versioning**: None yet; breaking changes will be communicated in [Changelog](#changelog) before deployment.

---

## Authentication

SafeHer uses a **dual-mode auth model**:

1. **Production (recommended):** a Supabase Auth JWT (HS256) attached as
   `Authorization: Bearer <token>`. Verified locally against
   `SUPABASE_JWT_SECRET` — no network round-trip.
2. **Hackathon / dev fallback:** the legacy SafeHer HMAC token
   (`safeher.token` in localStorage) or the `X-Session-Id` header for
   unauthenticated endpoints.

### Headers

| Header | Required for | Notes |
|---|---|---|
| `Authorization: Bearer <jwt>` | `/auth/*`, `/circles/*` | Supabase access token OR legacy SafeHer HMAC token. The frontend auto-attaches it. |
| `X-Session-Id` | trusted-circle endpoints when no JWT is present, incident reports, anonymous SOS | UUID-like string (`dev-...`, `usr_...`). The frontend auto-generates and persists this in `localStorage`. |

Example with JWT (production):

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItMTIzIiw...
```

Example with X-Session-Id (dev fallback):

```
X-Session-Id: dev-abc123def456
```

If neither is valid on a protected endpoint, the API returns
**`401 Unauthorized`** with `{"detail": "Missing or invalid auth"}` (or
`"Invalid token"` / `"Missing token"` depending on the endpoint).

### Login flow

```http
POST /auth/login
Content-Type: application/json

{ "email": "nadia@example.com", "password": "hackathon99" }
```

Returns:

```json
{
  "token": "594fd...<HMAC signed>",
  "user": {
    "id": "594fd...",
    "name": "Nadia",
    "email": "nadia@example.com",
    "phone": "+8801712345678",
    "home_area": "Halishahar",
    "photo_url": "https://storage.googleapis.com/.../photo.jpg",
    "phone_verified": true
  }
}
```

The frontend persists the `token` to `localStorage.safeher.token` and
attaches it as `Authorization: Bearer` on every subsequent request.
For Supabase Auth, the JWT lives at `localStorage.safeher.jwt` and is
preferred when present.

---

## Rate limiting

A per-process sliding-window limiter enforces the following caps:

| Endpoint | Cap | Window | Key |
|---|---|---|---|
| `POST /chat/` | 30 requests | 60 s | `X-Session-Id` or IP |
| `GET /geocode/` | 10 requests | 60 s | `X-Session-Id` or IP |
| `POST /incidents/` | 10 requests | 1 hour | `X-Session-Id` or IP |

When you exceed the cap, the response is:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47
Content-Type: application/json

{
  "detail": {
    "message": "Too many requests. Please slow down.",
    "retry_after_seconds": 48
  }
}
```

The `Retry-After` header is in seconds and indicates the minimum wait before retrying.

> For multi-instance production, swap the in-process dict for a Redis-backed token bucket.

---

## Error handling

**Safety-critical design:** the chat endpoint **never** returns a 500. Every other endpoint returns a JSON error body with a `detail` field.

| Status | When | Response shape |
|---|---|---|
| `200 OK` | Success (or chat fallback) | endpoint-specific |
| `201 Created` | Resource created | endpoint-specific |
| `422 Unprocessable Entity` | Validation failed (out of bounds, bad input) | `{"detail": "<message>"}` |
| `404 Not Found` | Resource missing or no path between coordinates | `{"detail": "...", "suggestion": "..."}` |
| `429 Too Many Requests` | Rate limit exceeded | see [Rate limiting](#rate-limiting) |
| `500 Internal Server Error` | Catch-all for unhandled exceptions | `{"detail": "...", "emergency": "জরুরী সাহায্যের জন্য ৯৯৯ কল করুন।"}` |
| `503 Service Unavailable` | Graph not yet loaded (server still starting) | `{"detail": "...", "retry_after_seconds": 10}` |

Bengali emergency message is always included in any non-200 chat response.

---

## Endpoints

### `GET /`

**Liveness check + API entry point.**

```http
GET / HTTP/1.1
Host: localhost:8000
```

**Response 200**

```json
{
  "message": "Welcome to SafeHer API",
  "docs": "/docs",
  "emergency": "If in danger, call 999"
}
```

---

### `GET /health`

**Deep health check** — used by Render's free-tier keep-alive and by the frontend's startup screen.

Returns the state of the two heavy singletons: the routing graph and the ChromaDB knowledge base.

```http
GET /health HTTP/1.1
```

**Response 200**

```json
{
  "status": "ok",
  "graph": {
    "loaded": true,
    "nodes": 48217,
    "edges": 102841,
    "error": null
  },
  "knowledge_base": {
    "document_count": 64,
    "name": "safeher_kb"
  }
}
```

If the graph file is missing, `status` becomes `"degraded (graph missing)"`. If the KB is empty, it becomes `"degraded (kb empty)"`. Neither is fatal — the server still serves chat and SOS endpoints.

---

### `POST /chat/`

**RAG-powered safety assistant** with bilingual (Bengali / Banglish / English) support.

This endpoint is **safety-critical**. It will never return 500; any failure mode degrades to the hard-coded `EMERGENCY_FALLBACK`.

**Rate limit:** 30 requests / 60 s / session

```http
POST /chat/ HTTP/1.1
Content-Type: application/json

{
  "query": "amake ekjon help korte parbe keu?",
  "conversation_id": "optional-string"
}
```

**Request body**

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `query` | string | yes | 1–1000 chars | Accepts Bengali script, Banglish (romanized), code-mixed, or pure English |
| `conversation_id` | string | no | — | For client-side session tracking. Not yet used server-side |

**Response 200**

```json
{
  "reply": "জরুরী সাহায্যের জন্য ৯৯৯ কল করুন। নারী ও শিশু হেল্পলাইন ১০৯২১।",
  "lang_detected": "banglish",
  "was_transliterated": true,
  "fallback_used": false
}
```

| Field | Type | Notes |
|---|---|---|
| `reply` | string | AI-generated response in Bengali script (or English if input was English) |
| `lang_detected` | string | One of: `bn`, `banglish`, `en`, `code_mixed`, `unknown` |
| `was_transliterated` | bool | True if Banglish was converted to Bengali script before embedding |
| `fallback_used` | bool | True if RAG returned no relevant passages; `reply` is the hard-coded emergency message |

**Emergency fast-path**

If the detector finds Bengali/Banglish danger words (`বাঁচাও`, `help`, `আমাকে মারছে`, etc.), the retrieval uses a relaxed threshold and prepends a `CRITICAL EMERGENCY` directive to the system prompt.

**Example — emergency**

```bash
curl -X POST http://localhost:8000/chat/ \
  -H 'Content-Type: application/json' \
  -d '{"query": "আমাকে কেউ মারছে, এখনই কাকে কল করব?"}'
```

```json
{
  "reply": "৯৯৯ কল করুন — এখনই। নিরাপদ দূরত্বে যান। নারী ও শিশু হেল্পলাইন ১০৯২১।",
  "lang_detected": "bn",
  "was_transliterated": false,
  "fallback_used": false
}
```

**Example — fallback**

When the RAG pipeline cannot find relevant context:

```json
{
  "reply": "এই তথ্য আমার কাছে নেই। জরুরী সাহায্যের জন্য ৯৯৯ কল করুন।",
  "lang_detected": "en",
  "was_transliterated": false,
  "fallback_used": true
}
```

---

### `GET /route/`

**Safe + fast route recommendation** between two coordinates.

Returns a GeoJSON `FeatureCollection` with two `LineString` features (safe + fast) for direct Mapbox GL JS rendering.

**Rate limit:** none (currently)

```http
GET /route/?olat=22.3569&olng=91.7832&dlat=22.3349&dlng=91.8123 HTTP/1.1
```

**Query parameters**

| Param | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `olat` | float | yes | 20.5–26.7 (BD latitude) | Origin latitude |
| `olng` | float | yes | 88.0–92.7 (BD longitude) | Origin longitude |
| `dlat` | float | yes | same as above | Destination latitude |
| `dlng` | float | yes | same as above | Destination longitude |

**Response 200**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[91.78, 22.35], [91.79, 22.36], ...]
      },
      "properties": {
        "route_type": "safe",
        "color": "#14b8a6",
        "weight": 5,
        "opacity": 0.85,
        "distance_m": 1843,
        "distance_display": "1.8km",
        "walk_time_min": 23.0,
        "avg_safety_score": 0.74,
        "safety_label": "Safe",
        "segment_count": 47,
        "segments": [
          { "safety": 0.82, "length": 47.3, "lighting": 0.9 },
          { "safety": 0.71, "length": 38.1, "lighting": 0.6 }
        ],
        "summary": {
          "safe_distance_m": 1843,
          "fast_distance_m": 1521,
          "extra_distance_m": 322,
          "extra_minutes": 4.0,
          "safe_avg_safety": 0.74,
          "fast_avg_safety": 0.41
        }
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "LineString", "coordinates": [...] },
      "properties": {
        "route_type": "fast",
        "color": "#f59e0b",
        "weight": 3,
        "opacity": 0.65,
        "distance_m": 1521,
        "avg_safety_score": 0.41,
        "safety_label": "Caution",
        ...
      }
    }
  ]
}
```

**Properties reference**

| Property | Type | Notes |
|---|---|---|
| `route_type` | `"safe"` \| `"fast"` | First feature is safe, second is fast |
| `color` | hex string | Mapbox line color (emerald for safe, amber for fast) |
| `distance_m` | int | Total length in meters |
| `distance_display` | string | `"1.8km"` or `"473m"` |
| `walk_time_min` | float | Assumes 80 m/min walking pace |
| `avg_safety_score` | float | 0–1, weighted by segment length |
| `safety_label` | `"Safe"` \| `"Moderate"` \| `"Caution"` | Bucketed from `avg_safety_score` |
| `segment_count` | int | Number of edges in the route |
| `segments[]` | array | Per-edge data for detailed display |
| `summary.*` | object | Top-level comparison metrics (only on safe route) |

**Edge cases**

| Case | Response |
|---|---|
| Coordinates outside Bangladesh | `422` — `{"detail": "Origin coordinates are outside Bangladesh."}` |
| Origin ≈ destination | `200` — single-point FeatureCollection with `"message": "You are already at your destination."` |
| No walkable path | `404` — `{"detail": "No walkable path found...", "suggestion": "Try coordinates closer to main roads..."}` |
| Graph not yet loaded | `503` — `{"detail": "Server is still starting up...", "retry_after_seconds": 10}` |

---

### `GET /geocode/`

**Resolve a place name to lat/lng** via OpenStreetMap Nominatim with a Bangladesh viewbox.

**Rate limit:** 10 requests / 60 s / session

```http
GET /geocode/?name=GEC%20Circle HTTP/1.1
```

**Query parameters**

| Param | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `name` | string | yes | 2–200 chars | Place name. Biases to `countrycodes=bd` |

**Response 200**

```json
{
  "query": "GEC Circle",
  "found": true,
  "results": [
    {
      "name": "GEC Circle, Chittagong, Chittagong Division, Bangladesh",
      "lat": 22.3593,
      "lng": 91.8217,
      "importance": 0.42,
      "type": "junction",
      "category": "highway"
    },
    {
      "name": "GEC More, Chittagong, Bangladesh",
      "lat": 22.3549,
      "lng": 91.8196,
      "importance": 0.18,
      "type": "residential",
      "category": "place"
    }
  ]
}
```

When no results match:

```json
{
  "query": "asdfqwerty",
  "found": false,
  "results": []
}
```

**Upstream:** Nominatim's free tier. Internally throttled to ≤1 RPS to comply with their TOS.

---

### `POST /incidents/`

**Submit an anonymous community incident report.**

**Rate limit:** 10 requests / 1 hour / session

```http
POST /incidents/ HTTP/1.1
Content-Type: application/json
X-Session-Id: dev-abc123

{
  "lat": 22.3624,
  "lng": 91.8213,
  "category": "unsafe_lighting",
  "description": "Entire stretch from GEC to 2 No Gate is dark after 9 PM",
  "time_of_day": "night",
  "anonymous": true,
  "session_id": "dev-abc123"
}
```

**Request body**

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `lat` | float | yes | 20.5–26.7 | |
| `lng` | float | yes | 88.0–92.7 | |
| `category` | enum | yes | See below | |
| `description` | string | no | max 500 chars | HTML stripped; truncated with `...` if too long |
| `time_of_day` | enum | no (default `"night"`) | See below | |
| `anonymous` | bool | no (default `true`) | | Always store anonymously |
| `session_id` | string | no | | Used for rate limiting; falls back to `X-Session-Id` header |

**Category enum**

| Value | |
|---|---|
| `eve_teasing` | |
| `stalking` | |
| `physical_assault` | |
| `rape` | |
| `robbery` | |
| `unsafe_lighting` | |
| `unsafe_transport` | |
| `other` | |

**Time-of-day enum**

| Value |
|---|
| `morning` (06–12) |
| `afternoon` (12–17) |
| `evening` (17–20) |
| `night` (20–06) |

**Response 201**

```json
{
  "success": true,
  "id": "5f9e1d3a-7c8b-4a3e-b6d2-1a2b3c4d5e6f",
  "message": "Report received. Thank you for making the community safer."
}
```

---

### `GET /incidents/nearby`

**Fetch incidents within a radius** as a GeoJSON `FeatureCollection` for map overlays.

```http
GET /incidents/nearby?lat=22.3569&lng=91.7832&radius_m=1000&days_back=30 HTTP/1.1
```

**Query parameters**

| Param | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `lat` | float | yes | — | 20.5–26.7 |
| `lng` | float | yes | — | 88.0–92.7 |
| `radius_m` | int | no | `1000` | 100–5000 |
| `days_back` | int | no | `30` | 1–365 |

**Response 200**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [91.8213, 22.3624]
      },
      "properties": {
        "id": "5f9e1d3a-7c8b-4a3e-b6d2-1a2b3c4d5e6f",
        "category": "unsafe_lighting",
        "time_of_day": "night",
        "description": "Entire stretch from GEC to 2 No Gate is dark after 9 PM",
        "created_at": "2025-06-12T18:42:11",
        "report_count": 1
      }
    }
  ]
}
```

---

### `POST /sos/log`

**Log an SOS activation** to the audit trail.

This endpoint exists for **analytics and abuse prevention only**. The actual SOS alerts (emails/SMS) are sent client-side via EmailJS for reliability and speed.

```http
POST /sos/log HTTP/1.1
Content-Type: application/json

{
  "session_id": "sos-2025-07-09-abc123",
  "lat": 22.3624,
  "lng": 91.8213,
  "timestamp": 1720531331000,
  "trigger_method": "voice_command",
  "lang_at_trigger": "bn"
}
```

**Request body**

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `session_id` | string | yes | — | A unique ID for the emergency. Used for de-duplication (30 s window). |
| `lat` | float | yes | — | Out-of-BD is allowed (logged with warning) |
| `lng` | float | yes | — | |
| `timestamp` | int | yes | Unix ms | When the SOS fired |
| `trigger_method` | enum | yes | `button_hold`, `voice_command`, `disguise_mode`, `test` | `test` events are silently ignored |
| `lang_at_trigger` | string | no | — | UI language at activation time |

**Response 201**

```json
{ "logged": true }
```

For test events:

```json
{ "logged": true, "note": "Test event ignored" }
```

**De-duplication:** identical `session_id` activations within 30 s are silently dropped (so pressing the button AND shouting "বাঁচাও" in the same moment logs as one event).

---

### `GET /heatmap/`

**Curated incident heatmap data** for the map layer.

Returns a hand-curated GeoJSON of community-flagged unsafe hotspots. Used by the landing page's map preview and the in-app heatmap toggle.

```http
GET /heatmap/ HTTP/1.1
```

**Response 200**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [91.7832, 22.3569]
      },
      "properties": {
        "intensity": 0.8,
        "category": "unsafe_lighting",
        "notes": "Dark underpass after 9 PM"
      }
    }
  ]
}
```

If the curated file is missing, returns an empty `FeatureCollection`.

---

## Authentication

Authentication endpoints for signup, login, and managing emergency contacts.
All `/auth/*` endpoints require a JWT or HMAC token for `GET /auth/me`,
`POST /auth/contacts`, and `DELETE /auth/contacts/{id}`. Signup and login
are public.

### `POST /auth/signup`

**Create a new SafeHer account. Three-step flow:**

1. Client collects basic info + home area.
2. Client verifies the phone via Firebase OTP (separate endpoint — see
   the Firebase Auth docs).
3. Client uploads the profile photo to Firebase Storage (separate —
   see Firebase Storage docs).
4. Client calls this endpoint with all collected data.

```http
POST /auth/signup HTTP/1.1
Content-Type: application/json

{
  "name": "Nadia Hossain",
  "email": "nadia@example.com",
  "phone": "+8801712345678",
  "password": "hackathon99",
  "home_area": "Halishahar",
  "photo_url": "https://firebasestorage.../photo.jpg",
  "phone_verified": true
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Trimmed; non-empty |
| `email` | yes | Validated; disposable domains blocked |
| `phone` | yes | E.164 format preferred; `+8801XXXXXXXXX` |
| `password` | yes | Min 8 chars; cannot be all-numeric |
| `home_area` | no | Free text — used for map centering + chatbot context |
| `photo_url` | no | Public URL of the uploaded profile photo |
| `phone_verified` | no | Should be `true` if Firebase OTP succeeded |

**Response 201:**

```json
{
  "token": "594fd...<HMAC signed>",
  "user": {
    "id": "594fd...",
    "name": "Nadia Hossain",
    "email": "nadia@example.com",
    "phone": "+8801712345678",
    "home_area": "Halishahar",
    "photo_url": "https://firebasestorage.../photo.jpg",
    "phone_verified": true
  }
}
```

**Errors:**
- `400` — `{"detail": "Disposable / temporary email addresses are not allowed..."}`
- `400` — `{"detail": "Password must be at least 8 characters"}`
- `400` — `{"detail": "Password cannot be entirely numeric"}`
- `400` — `{"detail": "Email already registered"}`

### `POST /auth/login`

```http
POST /auth/login HTTP/1.1
Content-Type: application/json

{ "email": "nadia@example.com", "password": "hackathon99" }
```

**Response 200:** Same shape as signup, minus the request fields.

**Errors:**
- `401` — `{"detail": "Invalid credentials"}`

### `GET /auth/me`

Returns the current user + their emergency contacts. Requires `Authorization: Bearer <token>`.

```http
GET /auth/me HTTP/1.1
Authorization: Bearer 594fd...<HMAC signed>
```

**Response 200:**

```json
{
  "user": {
    "id": "594fd...",
    "name": "Nadia Hossain",
    "email": "nadia@example.com",
    "phone": "+8801712345678",
    "home_area": "Halishahar",
    "photo_url": "https://firebasestorage.../photo.jpg",
    "phone_verified": true
  },
  "contacts": [
    {
      "id": "f93eaebf...",
      "name": "Mum",
      "phone": "+8801811111111",
      "email": "mum@example.com",
      "relation": "Family"
    }
  ]
}
```

### `POST /auth/contacts`

Add an emergency contact for the current user.

```http
POST /auth/contacts HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Mum",
  "phone": "+8801811111111",
  "email": "mum@example.com",
  "relation": "Family"
}
```

**Response 201:** The created contact (with assigned `id` and `user_id`).

### `DELETE /auth/contacts/{contact_id}`

Remove an emergency contact.

```http
DELETE /auth/contacts/f93eaebf-c0ff-4c6f-986a-87727e1a6563 HTTP/1.1
Authorization: Bearer <token>
```

**Response 200:** `{"status": "deleted"}`

---

## Trusted Circles

Trusted Circles are per-device groupings of contacts (family, friends, roommates) that get SOS alerts. Endpoints accept **either** `Authorization: Bearer <jwt>` (production) **or** `X-Session-Id` (dev fallback).

### `POST /circles/`

**Create a new trusted circle.**

```http
POST /circles/ HTTP/1.1
Content-Type: application/json
X-Session-Id: dev-abc123

{ "name": "Family", "color": "#FF4D6D" }
```

**Request body**

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `name` | string | yes | 1–80 chars | Display name |
| `color` | string | no | `#RRGGBB` hex | Defaults to `#FF4D6D` (rose-coral) |

**Response 201**

```json
{
  "id": "cir-7a8b9c-...",
  "owner_id": "dev-abc123",
  "name": "Family",
  "color": "#FF4D6D",
  "member_count": 0
}
```

**Errors**

| Status | Reason |
|---|---|
| `401` | Missing or invalid `X-Session-Id` |

---

### `GET /circles/`

**List all circles owned by the current session.**

```http
GET /circles/ HTTP/1.1
X-Session-Id: dev-abc123
```

**Response 200**

```json
[
  {
    "id": "cir-7a8b9c-...",
    "owner_id": "dev-abc123",
    "name": "Family",
    "color": "#FF4D6D",
    "member_count": 3
  },
  {
    "id": "cir-d4e5f6-...",
    "owner_id": "dev-abc123",
    "name": "Roommates",
    "color": "#14b8a6",
    "member_count": 2
  }
]
```

---

### `GET /circles/{id}`

**Get one circle with its full member list.**

```http
GET /circles/cir-7a8b9c HTTP/1.1
X-Session-Id: dev-abc123
```

**Response 200**

```json
{
  "id": "cir-7a8b9c",
  "owner_id": "dev-abc123",
  "name": "Family",
  "color": "#FF4D6D",
  "member_count": 3,
  "members": [
    {
      "id": "mem-aaa",
      "name": "Mother",
      "contact": "+8801712345678",
      "relation": "mother"
    },
    {
      "id": "mem-bbb",
      "name": "Sister",
      "contact": "sister@example.com",
      "relation": "sister"
    }
  ]
}
```

**Errors**

| Status | Reason |
|---|---|
| `404` | Circle does not exist or is not owned by this session |

---

### `DELETE /circles/{id}`

**Delete a circle** (cascades to all members).

```http
DELETE /circles/cir-7a8b9c HTTP/1.1
X-Session-Id: dev-abc123
```

**Response 200**

```json
{ "deleted": true }
```

**Errors**

| Status | Reason |
|---|---|
| `404` | Circle does not exist or is not owned by this session |

---

### `POST /circles/{id}/members`

**Add a member to a circle.**

```http
POST /circles/cir-7a8b9c/members HTTP/1.1
Content-Type: application/json
X-Session-Id: dev-abc123

{
  "name": "Best friend",
  "contact": "+8801812345678",
  "relation": "friend"
}
```

**Request body**

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `name` | string | yes | 1–80 chars | |
| `contact` | string | yes | 3–120 chars | Phone, email, or handle. Strips HTML / quotes. |
| `relation` | string | no | max 40 chars | e.g. "mother", "friend", "colleague" |

**Response 201**

```json
{
  "id": "mem-ccc",
  "name": "Best friend",
  "contact": "+8801812345678",
  "relation": "friend"
}
```

**Errors**

| Status | Reason |
|---|---|
| `404` | Circle does not exist or is not owned by this session |
| `422` | Invalid contact (HTML, quotes, or empty) |

---

### `DELETE /circles/{id}/members/{member_id}`

**Remove a member from a circle.**

```http
DELETE /circles/cir-7a8b9c/members/mem-ccc HTTP/1.1
X-Session-Id: dev-abc123
```

**Response 200**

```json
{ "removed": true }
```

**Errors**

| Status | Reason |
|---|---|
| `404` | Circle or member does not exist (or not owned by this session) |

---

## Webhooks

SafeHer does **not** currently send outbound webhooks. The frontend pushes events to the backend; the backend never calls back to the client.

If you need server-initiated notifications (e.g. when a Trusted Circle member joins), implement it as a future FastAPI `BackgroundTask` that POSTs to your endpoint.

---

## Changelog

### v1.0.0 — current

- ✅ All endpoints documented above are live
- ✅ RAG chat with Gemini 2.5 Flash + Groq fallback
- ✅ Safe + fast route scoring
- ✅ Trusted Circles CRUD
- ✅ Geocoding via Nominatim (BD-bounded)
- ✅ Community incident reporting
- ✅ Per-session rate limiting

### Planned

- 🔜 `/auth/login`, `/auth/signup` — Supabase Auth integration
- 🔜 `/notifications/dispatch` — server-side SOS alert dispatch
- 🔜 Webhooks for circle events
- 🔜 Pagination on `/incidents/nearby`
- 🔜 Streaming responses on `/chat/`

---

## Reference

### Status codes used

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `401` | Unauthorized (missing/invalid `X-Session-Id`) |
| `404` | Not found |
| `422` | Validation error |
| `429` | Rate limit exceeded |
| `500` | Unhandled server error (includes Bengali emergency message) |
| `503` | Graph not loaded yet |

### GeoJSON types used

| Type | Used in |
|---|---|
| `FeatureCollection` | `/route/`, `/incidents/nearby`, `/heatmap/` |
| `Feature` | each route, each incident, each hotspot |
| `LineString` | routes |
| `Point` | incidents, hotspots |

### Bangladesh bounding box

```
Latitude:  20.5° – 26.7°
Longitude: 88.0° – 92.7°
```

All coordinate-accepting endpoints validate against this box. Out-of-bounds requests get `422`.

---

For setup, configuration, and architecture, see [`README.md`](./README.md).
For the original problem framing, see [`Problem.md`](./Problem.md).