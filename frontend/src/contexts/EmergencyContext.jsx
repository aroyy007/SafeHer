import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import emailjs from '@emailjs/browser';

import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import {
  TRACKING_TTL_MS,
  updateSessionProfile,
  clearSessionLocation,
} from '../features/tracking/firebaseClient';

const EmergencyContext = createContext();
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

function newSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return `sos-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  return `sos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  });
}

export function EmergencyProvider({ children }) {
  const activationRef = useRef(0);
  const emergencyActiveRef = useRef(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [notificationStatus, setNotificationStatus] = useState('idle');
  const [trackingUrl, setTrackingUrl] = useState(null);
  const [emergencySessionId, setEmergencySessionId] = useState(null);
  const [emergencySessionCreatedAt, setEmergencySessionCreatedAt] = useState(null);
  const [emergencySessionExpiresAt, setEmergencySessionExpiresAt] = useState(null);
  const { contacts, user } = useAuth();

  const reverseGeocode = async (loc) => {
    if (!loc) return null;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json&accept-language=en`);
      if (!res.ok) return null;
      return (await res.json()).display_name || null;
    } catch {
      return null;
    }
  };

  const sendAlertEmail = useCallback(async (loc, sessionId, resolvedAddress, activationId, createdAt, expiresAt) => {
    let recipients = (contacts || []).filter((contact) => contact.email?.trim());
    try {
      const saved = await Promise.race([
        api.auth.getSOSContacts(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('contact lookup timeout')), 2000)),
      ]);
      if (Array.isArray(saved.recipients)) recipients = saved.recipients;
    } catch {
      // Keep the locally loaded emergency contacts as a recovery path.
    }
    if (activationRef.current !== activationId) return;
    const unique = new Map(recipients.filter((c) => c.email).map((c) => [c.email.trim().toLowerCase(), c]));
    const emailContacts = [...unique.values()];
    if (!emailContacts.length) {
      setNotificationStatus('no_contacts');
      return;
    }

    const link = `${window.location.origin}/track/${encodeURIComponent(sessionId)}`;
    setTrackingUrl(link);
    const formattedTime = new Date().toLocaleString('en-BD', {
      timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short',
    });
    const locationAddress = resolvedAddress || (loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : 'Location unavailable');
    updateSessionProfile(sessionId, {
      name: user?.name, photoUrl: user?.photo_url, phone: user?.phone,
    }, { createdAt, expiresAt });

    const emailjsOutcomes = await Promise.allSettled(emailContacts.map(async (contact) => {
      if (activationRef.current !== activationId) return false;
      const templateParams = {
        to_name: contact.name || 'Trusted contact',
        to_email: contact.email,
        from_name: user?.name || 'A SafeHer user',
        from_phone: user?.phone || '—',
        time: formattedTime,
        location_address: locationAddress,
        tracking_link: link,
      };
      if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) return false;
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, { publicKey: EMAILJS_PUBLIC_KEY });
      return true;
    }));

    let sent = emailjsOutcomes.filter((outcome) => outcome.status === 'fulfilled' && outcome.value).length;
    const failedRecipients = emailContacts.filter((_, index) => {
      const outcome = emailjsOutcomes[index];
      return outcome.status !== 'fulfilled' || !outcome.value;
    });
    if (failedRecipients.length && activationRef.current === activationId) {
      try {
        const smtpBatch = failedRecipients.slice(0, 30);
        const result = await api.sosAlert({
          from_name: user?.name || 'A SafeHer user',
          from_phone: user?.phone || '—',
          location_address: locationAddress,
          tracking_link: link,
          time_str: formattedTime,
          recipients: smtpBatch.map((contact) => ({ name: contact.name || 'Trusted contact', email: contact.email })),
        });
        sent += Math.min(smtpBatch.length, Math.max(0, Number(result.sent) || 0));
      } catch {
        // EmailJS may still have delivered to some contacts; preserve that count.
      }
    }
    if (activationRef.current !== activationId) return;
    setNotificationStatus(sent === emailContacts.length ? 'sent' : sent > 0 ? 'partial' : 'failed');
  }, [contacts, user]);

  const activateSOS = useCallback(async (triggerMethod = 'button_hold') => {
    if (emergencyActiveRef.current) return;
    emergencyActiveRef.current = true;
    setIsEmergency(true);
    setNotificationStatus('sending');
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);

    const activationId = ++activationRef.current;
    const sessionId = newSessionId();
    const createdAt = Date.now();
    const expiresAt = createdAt + TRACKING_TTL_MS;
    setEmergencySessionId(sessionId);
    setEmergencySessionCreatedAt(createdAt);
    setEmergencySessionExpiresAt(expiresAt);
    const loc = await currentLocation();
    if (activationRef.current !== activationId) return;
    setLocation(loc);

    // Audit logging is best effort and must never delay the emergency alert.
    api.logSOS({
      session_id: sessionId,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      timestamp: Date.now(),
      trigger_method: triggerMethod,
      lang_at_trigger: 'bn-BD',
    }).catch(() => {});

    reverseGeocode(loc).then((resolved) => {
      if (activationRef.current === activationId) setAddress(resolved);
    });
    await sendAlertEmail(loc, sessionId, null, activationId, createdAt, expiresAt);
  }, [sendAlertEmail]);

  const cancelSOS = useCallback(() => {
    activationRef.current += 1;
    emergencyActiveRef.current = false;
    if (emergencySessionId) clearSessionLocation(emergencySessionId);
    setIsEmergency(false);
    setLocation(null);
    setAddress(null);
    setTrackingUrl(null);
    setEmergencySessionId(null);
    setEmergencySessionCreatedAt(null);
    setEmergencySessionExpiresAt(null);
    setNotificationStatus('idle');
  }, [emergencySessionId]);

  return (
    <EmergencyContext.Provider value={{
      isEmergency, activateSOS, cancelSOS, location, address, notificationStatus,
      trackingUrl, emergencySessionId, emergencySessionCreatedAt, emergencySessionExpiresAt,
    }}>
      {children}
    </EmergencyContext.Provider>
  );
}

export const useEmergency = () => useContext(EmergencyContext);
