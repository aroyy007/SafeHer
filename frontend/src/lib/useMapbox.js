import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

/**
 * useMapbox — a small custom hook that encapsulates Mapbox GL initialization,
 * cleanup, and the "is the token configured?" check.
 *
 * Returns { containerRef, map, isReady, error }.
 *
 * Usage:
 *   const { containerRef, map, isReady, error } = useMapbox({
 *     center: [lng, lat],
 *     zoom: 13,
 *     style: 'mapbox://styles/mapbox/dark-v11',
 *   });
 */
export function useMapbox({ center, zoom = 13, style = 'mapbox://styles/mapbox/dark-v11' } = {}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || token.startsWith('pk.your_')) {
      setError('Mapbox token not configured. Add VITE_MAPBOX_TOKEN to .env.local.');
      return;
    }
    if (!containerRef.current) return;

    mapboxgl.accessToken = token;

    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style,
        center,
        zoom,
        attributionControl: true,
      });
      mapRef.current = map;

      map.on('load', () => setIsReady(true));
      map.on('error', (e) => {
        // Don't crash on tile load errors; just log
        // eslint-disable-next-line no-console
        console.warn('[mapbox]', e?.error?.message || e);
      });

      // ResizeObserver to keep the map in sync with its container
      const ro = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.resize();
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        mapRef.current?.remove();
        mapRef.current = null;
        setIsReady(false);
      };
    } catch (err) {
      setError(err?.message || 'Failed to initialize Mapbox');
    }
  }, [token, style, JSON.stringify(center), zoom]);

  return { containerRef, map: mapRef.current, isReady, error, hasToken: !!token };
}
