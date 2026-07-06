import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Navigation, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

// Token is read from VITE_MAPBOX_TOKEN env var; falls back to a clean
// "unavailable" state if missing.
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith('pk.your_')) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export function MapContainer() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState(
    !MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith('pk.your_')
      ? 'Add VITE_MAPBOX_TOKEN to your .env.local to enable the map.'
      : null,
  );

  // Routing State
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const [startCandidates, setStartCandidates] = useState([]);
  const [endCandidates, setEndCandidates] = useState([]);

  useEffect(() => {
    if (mapError) return;
    if (!mapContainerRef.current) return;

    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [91.8033, 22.3569], // Chittagong
        zoom: 13,
      });

      mapRef.current.on('load', () => {
        setIsMapReady(true);
      });
    } catch (err) {
      setMapError('Failed to initialize Mapbox: ' + err.message);
    }

    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, [mapError]);

  /**
   * Resolve a place name to coordinates via the backend /geocode endpoint.
   * Returns { lat, lng } or null if not found.
   */
  const geocodeOne = async (name) => {
    const data = await api.geocode(name);
    if (!data?.found || !data.results?.length) return null;
    const top = data.results[0];
    return { lat: top.lat, lng: top.lng, candidates: data.results };
  };

  /**
   * When the user types a place name and pauses, fetch candidates
   * so they can pick the right one (e.g. "GEC" → GEC Circle vs GEC More).
   */
  const geocodeDebounced = async (which) => {
    const name = which === 'start' ? startPoint : endPoint;
    if (!name || name.trim().length < 3) {
      if (which === 'start') setStartCandidates([]);
      else setEndCandidates([]);
      return;
    }
    try {
      const data = await api.geocode(name);
      const candidates = data?.results || [];
      if (which === 'start') {
        setStartCandidates(candidates);
        if (candidates[0]) setStartCoords({ lat: candidates[0].lat, lng: candidates[0].lng });
      } else {
        setEndCandidates(candidates);
        if (candidates[0]) setEndCoords({ lat: candidates[0].lat, lng: candidates[0].lng });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Geocode failed:', err);
    }
  };

  const pickCandidate = (which, candidate) => {
    if (which === 'start') {
      setStartCoords({ lat: candidate.lat, lng: candidate.lng });
      setStartPoint(candidate.name);
      setStartCandidates([]);
    } else {
      setEndCoords({ lat: candidate.lat, lng: candidate.lng });
      setEndPoint(candidate.name);
      setEndCandidates([]);
    }
  };

  const handleRouteSubmit = async (e) => {
    e.preventDefault();
    if (!startPoint || !endPoint) return;

    setIsLoadingRoute(true);
    setErrorMsg(null);

    try {
      // Re-geocode at submit time so the user always gets a fresh
      // resolution (in case they typed but didn't pick a candidate).
      let sc = startCoords;
      let ec = endCoords;
      if (!sc) sc = await geocodeOne(startPoint);
      if (!ec) ec = await geocodeOne(endPoint);

      if (!sc || !ec) {
        setErrorMsg('Could not find one of those places. Try a different name (e.g. "GEC Circle, Chittagong").');
        setIsLoadingRoute(false);
        return;
      }

      const data = await api.route({
        olat: sc.lat,
        olng: sc.lng,
        dlat: ec.lat,
        dlng: ec.lng,
      });
      setRouteData(data);
      drawRouteOnMap(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMsg('Failed to load route from backend.');
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const drawRouteOnMap = (geojson) => {
    if (!mapRef.current || !isMapReady) return;

    const map = mapRef.current;

    // Remove existing layers/sources if any (safe + fast + candidates)
    for (const id of ['route-safe', 'route-fast', 'route-safe-layer', 'route-fast-layer']) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of ['route-safe', 'route-fast']) {
      if (map.getSource(id)) map.removeSource(id);
    }

    // Backend returns a FeatureCollection with [safe, fast] routes.
    const features = geojson.features || [];
    const safe = features[0];
    const fast = features[1];

    if (safe) {
      map.addSource('route-safe', { type: 'geojson', data: safe });
      map.addLayer({
        id: 'route-safe-layer',
        type: 'line',
        source: 'route-safe',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 6,
          'line-opacity': 0.85,
        },
      });
    }

    if (fast) {
      map.addSource('route-fast', { type: 'geojson', data: fast });
      map.addLayer({
        id: 'route-fast-layer',
        type: 'line',
        source: 'route-fast',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 3,
          'line-opacity': 0.6,
          'line-dasharray': [2, 2],
        },
      });
    }

    // Zoom to fit whichever route is available
    const targetFeature = safe || fast;
    if (targetFeature?.geometry?.coordinates?.length) {
      const coordinates = targetFeature.geometry.coordinates;
      const bounds = coordinates.reduce(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
      );
      map.fitBounds(bounds, { padding: 50 });
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Mapbox Canvas */}
      {mapError ? (
        <div className="flex-center" style={{ height: '100%', flexDirection: 'column', padding: '2rem', textAlign: 'center' }}>
          <Navigation size={48} color="var(--color-text-muted)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--color-warning)' }}>Map Unavailable</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{mapError}</p>
        </div>
      ) : (
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      )}

      {/* Floating Route Planner Panel */}
      <div 
        className="glass-panel" 
        style={{ 
          position: 'absolute', 
          top: '1rem', 
          left: '1rem', 
          right: '1rem', 
          padding: '1rem',
          zIndex: 10
        }}
      >
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Navigation size={18} color="var(--color-brand)" /> Plan Safe Route
        </h3>
        
        <form onSubmit={handleRouteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Start point (e.g. GEC Circle)"
              value={startPoint}
              onChange={(e) => {
                setStartPoint(e.target.value);
                setStartCoords(null);
                setStartCandidates([]);
              }}
              onBlur={() => {
                // small delay so a click on a candidate still fires
                setTimeout(() => geocodeDebounced('start'), 250);
              }}
              autoComplete="off"
              style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
            />
            {startCandidates.length > 1 && (
              <ul
                role="listbox"
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  listStyle: 'none', margin: '4px 0 0', padding: 0,
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '180px', overflowY: 'auto',
                  boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
                }}
              >
                {startCandidates.map((c, i) => (
                  <li
                    key={i}
                    role="option"
                    onClick={() => pickCandidate('start', c)}
                    style={{
                      padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Destination (e.g. 2 No Gate)"
              value={endPoint}
              onChange={(e) => {
                setEndPoint(e.target.value);
                setEndCoords(null);
                setEndCandidates([]);
              }}
              onBlur={() => {
                setTimeout(() => geocodeDebounced('end'), 250);
              }}
              autoComplete="off"
              style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
            />
            {endCandidates.length > 1 && (
              <ul
                role="listbox"
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  listStyle: 'none', margin: '4px 0 0', padding: 0,
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '180px', overflowY: 'auto',
                  boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
                }}
              >
                {endCandidates.map((c, i) => (
                  <li
                    key={i}
                    role="option"
                    onClick={() => pickCandidate('end', c)}
                    style={{
                      padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={isLoadingRoute || !startPoint || !endPoint} style={{ padding: '0.5rem' }}>
            {isLoadingRoute ? <Loader2 className="animate-spin" size={18} /> : "Find Safe Route"}
          </button>
          {errorMsg && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}
        </form>

        {routeData && routeData.features && routeData.features[0]?.properties && (() => {
          const safe = routeData.features[0].properties;
          const summary = safe.summary || {};
          return (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Safe route safety</span>
                <strong style={{ color: 'var(--color-success)' }}>
                  {safe.avg_safety_score?.toFixed(2) ?? '—'} / 1.0
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Distance (safe)</span>
                <strong>{safe.distance_display || `${Math.round((safe.distance_m || 0))}m`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Walk time</span>
                <strong>{safe.walk_time_min ?? '—'} min</strong>
              </div>
              {summary.extra_minutes != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                  <span>+{summary.extra_minutes} min vs fastest</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 3, background: '#10b981', borderRadius: 2 }} /> Safe
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 2, background: '#f59e0b', borderRadius: 2, borderTop: '1px dashed #f59e0b' }} /> Fast
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
