import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert, Share2, MapPin, WifiOff, AlertCircle, Check, ArrowRight } from 'lucide-react';
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
 *   2. Live map — shows the user's last position + status banner + emergency CTAs
 */
export function Track() {
  const { sessionId } = useParams();
  const [location, setLocation] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const [missing, setMissing] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef(null);

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

  useEffect(() => {
    if (!toast) return;
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

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
          {copied ? <Check size={12} /> : <Share2 size={12} />}
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
          <Check size={12} /> {toast}
        </div>
      ) : null}
    </div>
  );
}

/* ---- Sub-components ---- */

function EmptyState() {
  return (
    <div className="track__state" role="status">
      <div className="track__state-icon"><WifiOff size={24} /></div>
      <h1 className="track__state-title">Tracking link inactive</h1>
      <p className="track__state-text">
        The person you&rsquo;re trying to reach hasn&rsquo;t shared their location yet,
        or the link has expired.
      </p>
      <Link to="/" className="track__state-link">
        <ArrowRight size={14} /> Back to SafeHer
      </Link>
    </div>
  );
}

function StatusBanner({ isOnline, isStale, isOffline }) {
  let label, dotClass, dotAnimClass;
  if (isOnline) {
    label = 'Sharing live location';
    dotClass = 'track__status-dot--live';
    dotAnimClass = 'track__status-dot--live-anim';
  } else if (isStale) {
    label = 'Connection lost';
    dotClass = 'track__status-dot--stale';
    dotAnimClass = '';
  } else {
    label = 'Offline';
    dotClass = 'track__status-dot--offline';
    dotAnimClass = '';
  }

  return (
    <div className="track__status" role="status" aria-live="polite">
      <span className={`track__status-dot ${dotClass}`} aria-hidden="true">
        <span className={`track__status-dot-pulse ${dotAnimClass}`} />
      </span>
      <div className="track__status-content">
        <div className="track__status-label">
          {isOnline ? <><MapPin size={12} /> {label}</> : label}
        </div>
      </div>
    </div>
  );
}

function TrackingMap({ location, isOnline }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

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

  useEffect(() => {
    if (!location || !mapRef.current) return;
    const map = mapRef.current;

    if (!markerRef.current) {
      const customIcon = L.divIcon({
        className: 'track__marker' + (isOnline ? '' : ' track__marker--offline'),
        html: `<div class="track__marker-pin"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      markerRef.current = L.marker([location.lat, location.lng], { icon: customIcon }).addTo(map);
      map.setView([location.lat, location.lng], 15, { animate: true, duration: 1.5 });
      return;
    }

    markerRef.current.setLatLng([location.lat, location.lng]);
    map.setView([location.lat, location.lng], 15, { animate: true, duration: 1.5 });
  }, [location, isOnline]);

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