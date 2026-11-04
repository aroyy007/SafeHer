import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Loader2, Layers, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { IncidentReportModal } from '../sos/IncidentReportModal';
import { useLanguage } from '../../i18n/LanguageContext';
import './map.css';

// Fix Leaflet's default icon paths (broken by bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export function MapContainer() {
  const { t, language } = useLanguage();
  const translateRef = useRef(t);
  const languageRef = useRef(language);
  translateRef.current = t;
  languageRef.current = language;
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
  const [heatmapMetadata, setHeatmapMetadata] = useState(null);
  const [heatmapReady, setHeatmapReady] = useState(false);

  // Incident reporting
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCoords, setReportCoords] = useState(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize Leaflet map centered on Chittagong
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([22.3569, 91.7832], 13);

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

  // Load approximate CrimeDataBD counts aggregated by the backend into ~1 km cells.
  useEffect(() => {
    let cancelled = false;
    async function loadHeatmap() {
      try {
        const geo = await api.heatmap();
        if (cancelled) return;
        setHeatmapMetadata(geo?.metadata || null);
        const features = geo?.features || [];
        const cells = features.flatMap((feature) => {
          const coordinates = feature?.geometry?.coordinates;
          const recordCount = Number(feature?.properties?.record_count);
          const relativeDensity = Number(feature?.properties?.relative_density);
          if (
            feature?.geometry?.type !== 'Point'
            || !Array.isArray(coordinates)
            || coordinates.length !== 2
            || !coordinates.every(Number.isFinite)
            || !Number.isFinite(recordCount)
            || recordCount <= 0
            || !Number.isFinite(relativeDensity)
          ) return [];

          return [{
            lat: coordinates[1],
            lng: coordinates[0],
            recordCount,
            relativeDensity: Math.min(1, Math.max(0, relativeDensity)),
          }];
        });

        if (heatmapLayerRef.current) {
          mapRef.current?.removeLayer(heatmapLayerRef.current);
          heatmapLayerRef.current = null;
        }
        const layerGroup = L.layerGroup();
        cells.forEach((cell) => {
          const color = '#526F82';
          L.circle([cell.lat, cell.lng], {
            radius: 450,
            color,
            fillColor: color,
            fillOpacity: 0.06 + cell.relativeDensity * 0.22,
            weight: 1,
            opacity: 0.6,
            interactive: true,
          })
            .bindTooltip(
              () => {
                const translate = translateRef.current;
                const count = new Intl.NumberFormat(languageRef.current === 'bn' ? 'bn-BD' : 'en').format(cell.recordCount);
                return `<div style="font-size:0.75rem"><strong>${translate('Approximate source count')}</strong><br/>` +
                  `${count} ${translate('CrimeDataBD record(s) in this ~1 km cell.')}<br/>` +
                  `${translate('Not a street-level safety score.')}</div>`;
              },
              { direction: 'top', offset: [0, -8] }
            )
            .addTo(layerGroup);
        });
        heatmapLayerRef.current = layerGroup;
        setHeatmapReady(true);
      } catch (err) {
        if (cancelled) return;
        setHeatmapMetadata({ available: false, message: 'CrimeDataBD heatmap is unavailable.' });
        console.warn('Heatmap load failed:', err);
      }
    }
    if (mapRef.current) loadHeatmap();
    return () => { cancelled = true; };
  }, []);

  // Toggle visibility after loading without requesting the dataset again.
  useEffect(() => {
    const layer = heatmapLayerRef.current;
    const map = mapRef.current;
    if (!heatmapReady || !layer || !map) return;
    if (showHeatmap) {
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }
  }, [showHeatmap, heatmapReady]);

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

    // Heuristic route (moss)
    if (features[0]) {
      L.geoJSON(features[0], {
        style: { color: '#486A55', weight: 6, opacity: 0.9 },
      }).addTo(layerGroup);
    }

    // Distance-only route (muted amber, dashed)
    if (features[1]) {
      L.geoJSON(features[1], {
        style: { color: '#8C672D', weight: 3, opacity: 0.75, dashArray: '8 6' },
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
    <div className="map-container">
      <div ref={mapContainerRef} className="map-canvas" />

      {/* Floating action buttons — heatmap toggle + report incident */}
      <div className="map-controls">
        <button
          type="button"
          onClick={() => setShowHeatmap(v => !v)}
          aria-label={t('Toggle reported-record density layer')}
          title={t(showHeatmap ? 'Hide reported-record density' : 'Show reported-record density')}
          className={`btn map-control ${showHeatmap ? 'map-control--selected' : ''}`}
          aria-pressed={showHeatmap}
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
          aria-label={t('Report an incident here')}
          title={t('Report an incident at map center')}
          className="btn map-control map-control--report"
        >
          <AlertTriangle size={18} />
        </button>
      </div>

      {showHeatmap && (
        <div role="note" className="map-data-note">
          <strong>{t('CrimeDataBD v4 · CC BY-NC 4.0')}</strong>
          <div>
            {heatmapMetadata?.displayed_record_count > 0
              ? `${new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en').format(heatmapMetadata.displayed_record_count)} ${t('approximate records')} · ~${new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en', { maximumFractionDigits: 1 }).format(heatmapMetadata.approximate_cell_size_km)} ${t('km cells')} · ${new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en', { maximumFractionDigits: 1 }).format(Number(heatmapMetadata.coverage_radius_m) / 1000)} ${t('km graph coverage')} · ${t('darker fill means more source records')}`
              : t(heatmapMetadata?.message || 'Loading reported-record density…')}
          </div>
          <div>{t('News-derived; no year or victim-gender field. Not a safety score.')}</div>
        </div>
      )}

      {/* Incident report modal */}
      {showReportModal && (
        <IncidentReportModal
          initialCoords={reportCoords}
          onClose={() => setShowReportModal(false)}
          onReported={() => {
            // Community reports are stored separately; this layer shows the
            // canonical CrimeDataBD dataset only.
            setShowReportModal(false);
          }}
        />
      )}

      {/* Floating Route Planner Panel */}
      <div className="glass-panel map-route-panel">
        <h3 className="map-route-panel__title">
          <Navigation size={18} color="var(--color-brand)" /> {t('Plan route options')}
        </h3>

        <form onSubmit={handleRouteSubmit} className="map-route-form">
          {/* Start input */}
          <div>
            <label className="sr-only" htmlFor="route-start">{t('Starting point')}</label>
            <input
              id="route-start"
              type="text"
              className="input-field"
              aria-label={t('Starting point')}
              placeholder={t('Start point (e.g. GEC Circle)')}
              value={startPoint}
              onChange={(e) => { setStartPoint(e.target.value); setStartCoords(null); setStartCandidates([]); }}
              onBlur={() => setTimeout(() => geocodeDebounced('start'), 250)}
              autoComplete="off"
            />
            {startCandidates.length > 1 && (
              <ul className="map-suggestions">
                {startCandidates.map((c, i) => (
                  <li key={i}>
                    <button type="button" className="map-suggestion" onClick={() => pickCandidate('start', c)}>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* End input */}
          <div>
            <label className="sr-only" htmlFor="route-destination">{t('Destination')}</label>
            <input
              id="route-destination"
              type="text"
              className="input-field"
              aria-label={t('Destination')}
              placeholder={t('Destination (e.g. 2 No Gate)')}
              value={endPoint}
              onChange={(e) => { setEndPoint(e.target.value); setEndCoords(null); setEndCandidates([]); }}
              onBlur={() => setTimeout(() => geocodeDebounced('end'), 250)}
              autoComplete="off"
            />
            {endCandidates.length > 1 && (
              <ul className="map-suggestions">
                {endCandidates.map((c, i) => (
                  <li key={i}>
                    <button type="button" className="map-suggestion" onClick={() => pickCandidate('end', c)}>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" className="btn btn-primary map-route-submit" disabled={isLoadingRoute || !startPoint || !endPoint}>
            {isLoadingRoute ? <Loader2 className="animate-spin" size={18} aria-label={t('Loading')} /> : t('Compare routes')}
          </button>
          {errorMsg && (
            <div role="alert" className="map-route-error">{t(errorMsg)}</div>
          )}
        </form>

        {/* Route result summary */}
        {routeData?.features?.[0]?.properties && (() => {
          const heuristicRoute = routeData.features[0].properties;
          return (
            <div className="map-route-results">
              <div className="map-route-results__row">
                <span>{t('Heuristic route score')}</span>
                <strong>{heuristicRoute.avg_safety_score?.toFixed(2) ?? '—'} / 1.0</strong>
              </div>
              <div className="map-route-results__row">
                <span>{t('Distance')}</span>
                <strong>{heuristicRoute.distance_display || `${Math.round(heuristicRoute.distance_m || 0)}m`}</strong>
              </div>
              <div className="map-route-results__row">
                <span>{t('Walk time')}</span>
                <strong>{heuristicRoute.walk_time_min ?? '—'} {t('min')}</strong>
              </div>
              <p className="map-route-results__disclaimer">
                {t('Model estimate only; it is not a probability or a guarantee of safety.')}
              </p>
              <div className="map-route-legend">
                <span>
                  <i className="map-route-key map-route-key--heuristic" /> {t('Heuristic route')}
                </span>
                <span>
                  <i className="map-route-key map-route-key--distance" /> {t('Distance-only')}
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
