/**
 * Centralized API client.
 *
 * Every fetch to the FastAPI backend goes through this module so the
 * base URL is environment-driven (VITE_API_URL) instead of hard-coded.
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

const sessionHeaders = () => ({ 'X-Session-Id': getSessionId() });

export const api = {
  base: API_BASE,
  sessionId: getSessionId,

  health: () => request('/health'),

  chat: (query) =>
    request(`/chat?query=${encodeURIComponent(query)}`),

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
      request('/circles/', { headers: sessionHeaders() }),

    create: ({ name, color }) =>
      request('/circles/', {
        method: 'POST',
        body: JSON.stringify({ name, color }),
        headers: sessionHeaders(),
      }),

    get: (id) =>
      request(`/circles/${id}`, { headers: sessionHeaders() }),

    delete: (id) =>
      request(`/circles/${id}`, {
        method: 'DELETE',
        headers: sessionHeaders(),
      }),

    addMember: (circleId, { name, contact, relation }) =>
      request(`/circles/${circleId}/members`, {
        method: 'POST',
        body: JSON.stringify({ name, contact, relation }),
        headers: sessionHeaders(),
      }),

    removeMember: (circleId, memberId) =>
      request(`/circles/${circleId}/members/${memberId}`, {
        method: 'DELETE',
        headers: sessionHeaders(),
      }),
  },
};