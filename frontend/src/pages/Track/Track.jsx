import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert, Share2, MapPin, WifiOff, AlertCircle, Check, ArrowRight } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  isFirebaseReady,
  subscribeToLocation,
  TRACKING_TTL_MS,
} from '../../features/tracking/firebaseClient';
import './track.css';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';

/**
 * Track page — public, read-only.
 * Anyone with the link can see the live location of a single SafeHer user.
 *
 * Renders one of three states:
 *   1. Empty / missing — sessionId not found in Firebase
 *   2. Live map — shows the user's last position + status banner + emergency CTAs
 *   3. Expired — 24-hour retention window has ended
 */
export function Track() {
  const { t } = useLanguage();
  const { sessionId } = useParams();
  const [location, setLocation] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const [missing, setMissing] = useState(false);
  const [expired, setExpired] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    let expiryTimer = null;

    setLocation(null);
    setLastSeen(null);
    setProfile(null);
    setMissing(false);
    setExpired(false);

    const expireSession = () => {
      if (!active) return;
      active = false;
      setExpired(true);
      setLocation(null);
      setLastSeen(null);
      setProfile(null);
      setMissing(false);
      unsubscribe();
    };

    if (!isFirebaseReady) {
      const t = setTimeout(() => setMissing(true), 600);
      return () => {
        active = false;
        clearTimeout(t);
      };
    }

    unsubscribe = subscribeToLocation(sessionId, (data) => {
      if (!active) return;
      clearTimeout(expiryTimer);

      if (!data) {
        setLocation(null);
        setLastSeen(null);
        setProfile(null);
        setExpired(false);
        setMissing(true);
        return;
      }

      const expiresAt = getSessionExpiresAt(data);
      if (expiresAt && expiresAt <= Date.now()) {
        expireSession();
        return;
      }
      if (expiresAt) {
        expiryTimer = setTimeout(expireSession, expiresAt - Date.now());
      }

      setExpired(false);
      setProfile(data.profile || null);
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        setLocation({ lat: data.lat, lng: data.lng });
        setLastSeen(data.timestamp || Date.now());
        setMissing(false);
      } else {
        setLocation(null);
        setLastSeen(null);
        setMissing(true);
      }
    }, () => {
      if (!active) return;
      active = false;
      setLocation(null);
      setLastSeen(null);
      setProfile(null);
      setExpired(false);
      setMissing(true);
      unsubscribe();
    });

    return () => {
      active = false;
      clearTimeout(expiryTimer);
      unsubscribe();
    };
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
        await navigator.share({ title: t('SafeHer live location'), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setToast('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled or clipboard blocked — silent
    }
  }, [t]);

  return (
    <div className="track">
      {/* Top bar */}
      <div className="track__top">
        <Link to="/" className="track__brand" aria-label={t('SafeHer home')}>
          <span className="track__brand-mark" aria-hidden="true">
            <ShieldAlert size={12} strokeWidth={2.25} />
          </span>
          SafeHer
        </Link>
        <LanguageSwitcher />
        <button
          type="button"
          className="track__share"
          onClick={handleShare}
          aria-label={t('Copy tracking link')}
        >
          {copied ? <Check size={12} /> : <Share2 size={12} />}
          {t(copied ? 'Copied' : 'Share')}
        </button>
      </div>

      {expired || (missing && !location) ? (
        <EmptyState expired={expired} />
      ) : (
        <>
          <ProfileHeader profile={profile} />
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
          <div className="track__privacy" role="note">
            <ShieldAlert size={12} /> {t('Anyone holding this link can view the location while active. Expires after 24 hours.')}
          </div>
          <EmergencyActions />
        </>
      )}

      {toast ? (
        <div className="track__toast" role="status">
          <Check size={12} /> {t(toast)}
        </div>
      ) : null}
    </div>
  );
}

/* ---- Sub-components ---- */

function ProfileHeader({ profile }) {
  const { t } = useLanguage();
  // Renders a prominent photo + name at the top of the tracking page
  // so the trusted contact can confirm at a glance that the alert is
  // for the right person. If no profile is pushed yet (Firebase cold
  // start), we still show a SafeHer-branded placeholder.
  const name = profile?.name || t('SafeHer user');
  const photoUrl = profile?.photoUrl || '';
  const phone = profile?.phone || '';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="track__profile" role="region" aria-label={t('Person sharing location')}>
      <div className="track__profile-avatar">
        {photoUrl ? (
          <img src={photoUrl} alt={name} />
        ) : (
          <span className="track__profile-initials" aria-hidden="true">
            {initials || 'SH'}
          </span>
        )}
        <span className="track__profile-pulse" aria-hidden="true" />
      </div>
      <div className="track__profile-meta">
      <div className="track__profile-eyebrow">{t('Location shared by')}</div>
        <div className="track__profile-name">{name}</div>
        {phone && <div className="track__profile-phone">{phone}</div>}
      </div>
    </div>
  );
}

function EmptyState({ expired }) {
  const { t } = useLanguage();
  return (
    <div className="track__state" role="status">
      <div className="track__state-icon"><WifiOff size={24} /></div>
      <h1 className="track__state-title">{t(expired ? 'Tracking link expired' : 'Tracking link inactive')}</h1>
      <p className="track__state-text">
        {expired
          ? t('This tracking session expired after 24 hours. Its shared location and profile are no longer available.')
          : t('The person you’re trying to reach has not shared their location yet, or the link is no longer active.')}
      </p>
      <Link to="/" className="track__state-link">
        <ArrowRight size={14} /> {t('Back to SafeHer')}
      </Link>
    </div>
  );
}

function StatusBanner({ isOnline, isStale, isOffline }) {
  const { t } = useLanguage();
  let label, dotClass, dotAnimClass;
  if (isOnline) {
    label = t('Sharing live location');
    dotClass = 'track__status-dot--live';
    dotAnimClass = 'track__status-dot--live-anim';
  } else if (isStale) {
    label = t('Connection lost');
    dotClass = 'track__status-dot--stale';
    dotAnimClass = '';
  } else {
    label = t('Offline');
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
  const { t } = useLanguage();
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
      aria-label={t('Map showing the most recently shared location')}
    />
  );
}

function EmergencyActions() {
  const { t } = useLanguage();
  return (
    <div className="track__actions" role="group" aria-label={t('Emergency actions')}>
      <a href="tel:999" className="track__action track__action--primary">
        <span className="track__action-num">999</span>
        <span>{t('National Emergency')}</span>
      </a>
      <a href="tel:10921" className="track__action track__action--secondary">
        <span className="track__action-num">10921</span>
        <span>{t('Women & Child Helpline')}</span>
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

function getSessionExpiresAt(data) {
  const explicitExpiry = Number(data?.expiresAt);
  if (Number.isFinite(explicitExpiry) && explicitExpiry > 0) return explicitExpiry;

  // Older sessions have no expiry field. Match the server cleanup fallback:
  // use the last location timestamp, or profile update time if no location exists.
  const lastActivity = Number(data?.timestamp) || Number(data?.profile?.updatedAt);
  return Number.isFinite(lastActivity) && lastActivity > 0
    ? lastActivity + TRACKING_TTL_MS
    : null;
}
