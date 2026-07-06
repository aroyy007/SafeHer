import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Loader2, Layers, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { IncidentReportModal } from '../sos/IncidentReportModal';

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
  const heatmapLayerRef = useRef(null);

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

  // Heatmap toggle
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Incident reporting
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCoords, setReportCoords] = useState(null);

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

  // Load heatmap from backend (hand-curated hotspots)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${api.base}/heatmap/`);
        if (!res.ok) return;
        const geo = await res.json();
        if (cancelled) return;
        const features = geo?.features || [];
        const hotspots = features
          .filter(f => f?.geometry?.coordinates?.length === 2)
          .map(f => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            weight: Number(f.properties?.weight ?? 0.5),
            category: f.properties?.category || 'incident',
            id: f.properties?.id || `${f.geometry.coordinates.join(',')}`,
          }));
        if (heatmapLayerRef.current) {
          mapRef.current?.removeLayer(heatmapLayerRef.current);
          heatmapLayerRef.current = null;
        }
        const layerGroup = L.layerGroup();
        hotspots.forEach(h => {
          // color & radius scale with the curated weight (0-1)
          const radius = 120 + h.weight * 380;  // meters
          const color = h.weight >= 0.7 ? '#dc2626'   // red — high risk
                     : h.weight >= 0.45 ? '#f59e0b'  // amber — moderate
                     : '#facc15';                     // yellow — caution
          L.circle([h.lat, h.lng], {
            radius,
            color,
            fillColor: color,
            fillOpacity: 0.18,
            weight: 1,
            opacity: 0.6,
            interactive: true,
          })
            .bindTooltip(
              `<div style="font-size:0.75rem"><strong>Reported incidents</strong><br/>` +
              `Category: ${h.category}<br/>Risk: ${Math.round(h.weight * 100)}%</div>`,
              { direction: 'top', offset: [0, -8] }
            )
            .addTo(layerGroup);
        });
        heatmapLayerRef.current = layerGroup;
        if (showHeatmap) layerGroup.addTo(mapRef.current);
      } catch (err) {
        // Silently ignore — heatmap is decorative, not critical
        console.warn('Heatmap load failed:', err);
      }
    }
    if (mapRef.current) load();
    return () => { cancelled = true; };
  }, [showHeatmap]);

  // Toggle heatmap layer visibility without re-fetching
  useEffect(() => {
    const layer = heatmapLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    if (showHeatmap) {
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }
  }, [showHeatmap]);

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

      {/* Floating action buttons — heatmap toggle + report incident */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          zIndex: 1000,
        }}
      >
        <button
          type="button"
          onClick={() => setShowHeatmap(v => !v)}
          aria-label="Toggle incident heatmap"
          title={showHeatmap ? 'Hide incident heatmap' : 'Show incident heatmap'}
          className="btn"
          style={{
            width: 44,
            height: 44,
            padding: 0,
            background: showHeatmap ? 'var(--color-brand)' : 'rgba(255,255,255,0.95)',
            color: showHeatmap ? 'white' : 'var(--color-text-primary)',
            border: 'none',
            borderRadius: '50%',
            boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Layers size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            // Use map center if available, otherwise fall back to Chittagong centre.
            const c = mapRef.current?.getCenter
              ? mapRef.current.getCenter()
              : { lat: 22.3569, lng: 91.7832 };
            setReportCoords({ lat: c.lat, lng: c.lng });
            setShowReportModal(true);
          }}
          aria-label="Report an incident here"
          title="Report an incident at map center"
          className="btn"
          style={{
            width: 44,
            height: 44,
            padding: 0,
            background: 'var(--color-danger)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            boxShadow: 'var(--shadow-danger, 0 4px 12px rgba(220,38,38,0.4))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertTriangle size={18} />
        </button>
      </div>

      {/* Incident report modal */}
      {showReportModal && (
        <IncidentReportModal
          initialCoords={reportCoords}
          onClose={() => setShowReportModal(false)}
          onReported={() => {
            // After a successful report, refresh nearby incidents to show it on the map
            // (heatmap layer is a static curated set, so we just close the modal here)
            setShowReportModal(false);
          }}
        />
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
