import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert, Share2, MapPin, WifiOff, AlertCircle, Check } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

  // Initialize the map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      location ? [location.lat, location.lng] : [22.3569, 91.8033], 
      location ? 15 : 12
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Animate marker to new positions
  useEffect(() => {
    if (!location || !mapRef.current) return;

    const map = mapRef.current;
    
    if (!markerRef.current) {
      // create custom icon for marker
      const customIcon = L.divIcon({
        className: 'track__marker' + (isOnline ? '' : ' track__marker--offline'),
        html: `
          <div class="track__marker-pin" style="background:var(--color-brand); width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      markerRef.current = L.marker([location.lat, location.lng], { icon: customIcon }).addTo(map);
      map.setView([location.lat, location.lng], 15, { animate: true, duration: 1.5 });
      return;
    }

    // Subsequent updates: animate
    markerRef.current.setLatLng([location.lat, location.lng]);
    map.setView([location.lat, location.lng], 15, { animate: true, duration: 1.5 });
  }, [location, isOnline]);

  return (
    <div
      ref={containerRef}
      className="track__map"
      role="region"
      aria-label="Live location map"
      style={{ height: '300px', width: '100%' }}
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
