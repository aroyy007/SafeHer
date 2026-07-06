import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

// Fix Leaflet's default icon paths (broken by bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export function MapContainer() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);

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
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize Leaflet map centered on Chittagong
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([22.3569, 91.8033], 13);

    // Free OpenStreetMap tiles — no API key needed
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add zoom control to bottom-right (out of the way of the route panel)
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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
      let sc = startCoords;
      let ec = endCoords;

      if (!sc) {
        const data = await api.geocode(startPoint);
        if (data?.results?.[0]) sc = { lat: data.results[0].lat, lng: data.results[0].lng };
      }
      if (!ec) {
        const data = await api.geocode(endPoint);
        if (data?.results?.[0]) ec = { lat: data.results[0].lat, lng: data.results[0].lng };
      }

      if (!sc || !ec) {
        setErrorMsg('Could not find one of those places. Try a different name.');
        setIsLoadingRoute(false);
        return;
      }

      const data = await api.route({ olat: sc.lat, olng: sc.lng, dlat: ec.lat, dlng: ec.lng });
      setRouteData(data);
      drawRouteOnMap(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load route from backend.');
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const drawRouteOnMap = (geojson) => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove previous route layers
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }

    const features = geojson.features || [];
    const layerGroup = L.layerGroup();

    // Safe route (teal)
    if (features[0]) {
      L.geoJSON(features[0], {
        style: { color: '#10b981', weight: 6, opacity: 0.85 },
      }).addTo(layerGroup);
    }

    // Fast route (amber, dashed)
    if (features[1]) {
      L.geoJSON(features[1], {
        style: { color: '#f59e0b', weight: 3, opacity: 0.6, dashArray: '8 6' },
      }).addTo(layerGroup);
    }

    layerGroup.addTo(map);
    routeLayerRef.current = layerGroup;

    // Zoom to fit
    const targetFeature = features[0] || features[1];
    if (targetFeature?.geometry?.coordinates?.length) {
      const coords = targetFeature.geometry.coordinates.map(c => [c[1], c[0]]);
      map.fitBounds(coords, { padding: [50, 50] });
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

      {/* Floating Route Planner Panel */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          right: '1rem',
          padding: '1rem',
          zIndex: 1000,
        }}
      >
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Navigation size={18} color="var(--color-brand)" /> Plan Safe Route
        </h3>

        <form onSubmit={handleRouteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Start input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Start point (e.g. GEC Circle)"
              value={startPoint}
              onChange={(e) => { setStartPoint(e.target.value); setStartCoords(null); setStartCandidates([]); }}
              onBlur={() => setTimeout(() => geocodeDebounced('start'), 250)}
              autoComplete="off"
              style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
            />
            {startCandidates.length > 1 && (
              <ul role="listbox" style={dropdownStyle}>
                {startCandidates.map((c, i) => (
                  <li key={i} role="option" onClick={() => pickCandidate('start', c)} onMouseDown={(e) => e.preventDefault()} style={dropdownItemStyle}>
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* End input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Destination (e.g. 2 No Gate)"
              value={endPoint}
              onChange={(e) => { setEndPoint(e.target.value); setEndCoords(null); setEndCandidates([]); }}
              onBlur={() => setTimeout(() => geocodeDebounced('end'), 250)}
              autoComplete="off"
              style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
            />
            {endCandidates.length > 1 && (
              <ul role="listbox" style={dropdownStyle}>
                {endCandidates.map((c, i) => (
                  <li key={i} role="option" onClick={() => pickCandidate('end', c)} onMouseDown={(e) => e.preventDefault()} style={dropdownItemStyle}>
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={isLoadingRoute || !startPoint || !endPoint} style={{ padding: '0.5rem' }}>
            {isLoadingRoute ? <Loader2 className="animate-spin" size={18} /> : 'Find Safe Route'}
          </button>
          {errorMsg && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', textAlign: 'center' }}>{errorMsg}</div>
          )}
        </form>

        {/* Route result summary */}
        {routeData?.features?.[0]?.properties && (() => {
          const safe = routeData.features[0].properties;
          return (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Safety Score</span>
                <strong style={{ color: 'var(--color-success)' }}>{safe.avg_safety_score?.toFixed(2) ?? '—'} / 1.0</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Distance</span>
                <strong>{safe.distance_display || `${Math.round(safe.distance_m || 0)}m`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Walk time</span>
                <strong>{safe.walk_time_min ?? '—'} min</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 3, background: '#10b981', borderRadius: 2 }} /> Safe
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 2, background: '#f59e0b', borderRadius: 2 }} /> Fast
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

const dropdownStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
  listStyle: 'none', margin: '4px 0 0', padding: 0,
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  maxHeight: '180px', overflowY: 'auto',
  boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
};

const dropdownItemStyle = {
  padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer',
  borderBottom: '1px solid var(--color-border)',
};
