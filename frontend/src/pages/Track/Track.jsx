import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert, Share2, MapPin, WifiOff, AlertCircle, Check } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import { isFirebaseReady, subscribeToLocation } from '../../features/tracking/firebaseClient';
import './track.css';

/**
 * Track page — public, read-only.
 * Anyone with the link can see the live location of a single SafeHer user.
 *
 * Renders one of three states:
 *   1. Empty / missing — sessionId not found in Firebase
 *   2. Map unavailable — no Mapbox token configured
 *   3. Live map — shows the user's last position + status banner + emergency CTAs
 */
export function Track() {
  const { sessionId } = useParams();
  const [location, setLocation] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const [missing, setMissing] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef(null);

  // Subscribe to Firebase RTDB for the sessionId
  useEffect(() => {
    if (!isFirebaseReady) {
      const t = setTimeout(() => setMissing(true), 600);
      return () => clearTimeout(t);
    }
    const unsubscribe = subscribeToLocation(sessionId, (data) => {
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        setLocation({ lat: data.lat, lng: data.lng });
        setLastSeen(data.timestamp || Date.now());
        setMissing(false);
      } else {
        setMissing(true);
      }
    });
    return unsubscribe;
  }, [sessionId]);

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return;
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  // Live status logic
  const isOnline = lastSeen && Date.now() - lastSeen < 60_000;
  const isStale = lastSeen && Date.now() - lastSeen >= 60_000 && Date.now() - lastSeen < 24 * 3600_000;
  const isOffline = !lastSeen || Date.now() - lastSeen >= 24 * 3600_000;

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'SafeHer live location', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setToast('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled or clipboard blocked — silent
    }
  }, []);

  return (
    <div className="track">
      {/* Top bar */}
      <div className="track__top">
        <Link to="/" className="track__brand" aria-label="SafeHer home">
          <span className="track__brand-mark" aria-hidden="true">
            <ShieldAlert size={12} strokeWidth={2.25} />
          </span>
          SafeHer
        </Link>
        <button
          type="button"
          className="track__share"
          onClick={handleShare}
          aria-label="Copy tracking link"
        >
          {copied ? <Check size={14} /> : <Share2 size={14} />}
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>

      {missing && !location ? (
        <EmptyState />
      ) : (
        <>
          <StatusBanner
            isOnline={!!isOnline}
            isStale={!!isStale}
            isOffline={!!isOffline}
            lastSeen={lastSeen}
          />
          <TrackingMap
            location={location}
            isOnline={!!isOnline}
          />
          <div className="track__privacy">
            <ShieldAlert size={10} /> Shared via SafeHer · unguessable link
          </div>
          <EmergencyActions />
        </>
      )}

      {toast ? (
        <div className="track__toast" role="status">
          <Check size={14} /> {toast}
        </div>
      ) : null}
    </div>
  );
}

/* ---- Sub-components ---- */

function EmptyState() {
  return (
    <div className="track__state" role="status">
      <div className="track__state-icon"><WifiOff size={28} /></div>
      <h1 className="track__state-title">Tracking link inactive</h1>
      <p className="track__state-text">
        The person you're trying to reach hasn't shared their location yet, or the link has expired.
      </p>
      <Link to="/" className="track__state-link">← Back to SafeHer</Link>
    </div>
  );
}

function StatusBanner({ isOnline, isStale, isOffline, lastSeen }) {
  let label, dotClass;
  if (isOnline) {
    label = 'Live';
    dotClass = 'track__status-dot--live';
  } else if (isStale) {
    label = 'Connection lost';
    dotClass = 'track__status-dot--stale';
  } else {
    label = 'Offline';
    dotClass = 'track__status-dot--offline';
  }

  return (
    <div className="track__status" role="status" aria-live="polite">
      <span className={`track__status-dot ${dotClass}`} aria-hidden="true" />
      <div className="track__status-content">
        <div className="track__status-label">
          {isOnline ? <><MapPin size={14} /> Sharing live location</> : label}
        </div>
        <div className="track__status-meta">
          {lastSeen ? `Last seen ${formatRelative(lastSeen)}` : 'Waiting for first location update…'}
        </div>
      </div>
    </div>
  );
}

function TrackingMap({ location, isOnline }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const animRef = useRef(null);
  const isReadyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const tokenMissing = !token || token.startsWith('pk.your_');

  // Initialize the map
  useEffect(() => {
    if (tokenMissing) {
      setError('Add VITE_MAPBOX_TOKEN to your .env.local to enable the live map.');
      return;
    }
    if (!containerRef.current) return;

    mapboxgl.accessToken = token;
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: location ? [location.lng, location.lat] : [91.7832, 22.3569],
        zoom: location ? 15 : 12,
        attributionControl: true,
      });
      mapRef.current = map;
      map.on('load', () => {
        isReadyRef.current = true;
        setIsReady(true);
      });
      map.on('error', (e) => {
        // eslint-disable-next-line no-console
        console.warn('[mapbox]', e?.error?.message || e);
      });

      const ro = new ResizeObserver(() => map.resize());
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        cancelAnimationFrame(animRef.current);
        markerRef.current = null;
        mapRef.current?.remove();
        mapRef.current = null;
        isReadyRef.current = false;
        setIsReady(false);
      };
    } catch (err) {
      setError(err?.message || 'Failed to initialize Mapbox');
    }
    // We intentionally do not depend on `location` here — we only want to init once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenMissing]);

  // Animate marker to new positions
  useEffect(() => {
    if (!isReady || !location || !mapRef.current) return;

    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'track__marker' + (isOnline ? '' : ' track__marker--offline');
      el.innerHTML = `
        <div class="track__marker-pin"></div>
        <div class="track__marker-dot"></div>
      `;
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([location.lng, location.lat])
        .addTo(mapRef.current);
      mapRef.current.flyTo({
        center: [location.lng, location.lat],
        zoom: 15,
        duration: 1500,
        essential: true,
      });
      return;
    }

    // Subsequent updates: animate
    const start = markerRef.current.getLngLat();
    const end = { lng: location.lng, lat: location.lat };
    const t0 = performance.now();
    const duration = 1500;
    cancelAnimationFrame(animRef.current);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = easeInOutCubic(t);
      const lng = start.lng + (end.lng - start.lng) * e;
      const lat = start.lat + (end.lat - start.lat) * e;
      markerRef.current?.setLngLat([lng, lat]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [location, isReady, isOnline]);

  if (error || tokenMissing) {
    return (
      <div className="track__state">
        <div className="track__state-icon"><AlertCircle size={28} /></div>
        <h1 className="track__state-title">Map preview unavailable</h1>
        <p className="track__state-text">{error || 'Add VITE_MAPBOX_TOKEN to your .env.local to enable the live map.'}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="track__map"
      role="region"
      aria-label="Live location map"
    />
  );
}

function EmergencyActions() {
  return (
    <div className="track__actions" role="group" aria-label="Emergency actions">
      <a href="tel:999" className="track__action track__action--primary">
        <span className="track__action-num">999</span>
        <span>National Emergency</span>
      </a>
      <a href="tel:10921" className="track__action track__action--secondary">
        <span className="track__action-num">10921</span>
        <span>Women &amp; Child Helpline</span>
      </a>
    </div>
  );
}

/* ---- Helpers ---- */

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function formatRelative(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
