/**
 * Centralized API client.
 *
 * Every fetch to the FastAPI backend goes through this module so the
 * base URL is environment-driven (VITE_API_URL) instead of hard-coded.
 *
 * Auth: prefers a Supabase JWT (or legacy SafeHer token) stored in
 * localStorage under `safeher.token`. Falls back to an X-Session-Id
 * UUID for hackathon dev mode.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Throws a typed error with the response body attached, so callers can
 * surface meaningful messages to the user.
 */
async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`API ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  // Some endpoints (204) may have no body
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return res.text();
  return res.json();
}

/**
 * Build a stable per-device session ID used for rate limiting and
 * trusted-circle ownership. Persisted in localStorage so it survives
 * page reloads but stays local to one device.
 */
function getSessionId() {
  const KEY = 'safeher.sessionId';
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

/**
 * Read the auth token from localStorage. Order of preference:
 *   1. `safeher.jwt`     — Supabase access token (HS256 JWT)
 *   2. `safeher.token`   — legacy SafeHer HMAC token
 */
function getAuthToken() {
  return (
    localStorage.getItem('safeher.jwt') ||
    localStorage.getItem('safeher.token') ||
    null
  );
}

/**
 * Build auth headers. If we have a JWT, send it as Authorization: Bearer.
 * Always also send X-Session-Id so rate-limiter and dev-mode fallbacks work.
 */
const authHeaders = () => {
  const headers = { 'X-Session-Id': getSessionId() };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Legacy alias (kept for any callers still using sessionHeaders)
const sessionHeaders = authHeaders;

export const api = {
  base: API_BASE,
  sessionId: getSessionId,

  health: () => request('/health'),

  chat: (query) =>
    request('/chat/', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  /**
   * Route between two coordinates.
   * @param {{olat:number, olng:number, dlat:number, dlng:number}} coords
   */
  route: (coords) => {
    const params = new URLSearchParams(coords).toString();
    return request(`/route?${params}`);
  },

  /**
   * Resolve a place name ("GEC Circle") to lat/lng.
   * Returns { query, found: boolean, results: [{name, lat, lng, ...}] }
   */
  geocode: (name) => {
    const params = new URLSearchParams({ name }).toString();
    return request(`/geocode?${params}`);
  },

  incidentsNearby: (lat, lng, radius_m = 1000) =>
    request(`/incidents/nearby?lat=${lat}&lng=${lng}&radius_m=${radius_m}`),

  reportIncident: (incident) =>
    request('/incidents/', {
      method: 'POST',
      body: JSON.stringify(incident),
      headers: sessionHeaders(),
    }),

  logSOS: (event) =>
    request('/sos/log', { method: 'POST', body: JSON.stringify(event) }),

  // ----- Trusted Circles -----

  circles: {
    list: () =>
      request('/circles/', { headers: authHeaders() }),

    create: ({ name, color }) =>
      request('/circles/', {
        method: 'POST',
        body: JSON.stringify({ name, color }),
        headers: authHeaders(),
      }),

    get: (id) =>
      request(`/circles/${id}`, { headers: authHeaders() }),

    delete: (id) =>
      request(`/circles/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }),

    addMember: (circleId, { name, contact, relation }) =>
      request(`/circles/${circleId}/members`, {
        method: 'POST',
        body: JSON.stringify({ name, contact, relation }),
        headers: authHeaders(),
      }),

    removeMember: (circleId, memberId) =>
      request(`/circles/${circleId}/members/${memberId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }),
  },

  // ----- Incidents -----

  /**
   * Submit an anonymous safety incident report.
   * @param {{lat:number, lng:number, category:string, description?:string, time_of_day?:string, anonymous?:boolean}} data
   */
  reportIncident: (data) =>
    request('/incidents/', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: sessionHeaders(),
    }),

  /** Fetch hand-curated hotspot GeoJSON for the map heatmap layer. */
  heatmap: () => request('/heatmap/'),

  // ----- Auth & Contacts -----
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    // Reads token from localStorage automatically (Supabase JWT first, then legacy HMAC)
    getMe: () => request('/auth/me', { headers: authHeaders() }),
    addContact: (contact) =>
      request('/auth/contacts', { method: 'POST', headers: authHeaders(), body: JSON.stringify(contact) }),
    deleteContact: (id) =>
      request(`/auth/contacts/${id}`, { method: 'DELETE', headers: authHeaders() }),
  }
};