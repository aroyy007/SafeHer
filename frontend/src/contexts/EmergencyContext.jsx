import React, { createContext, useContext, useState } from 'react';
import emailjs from '@emailjs/browser';

import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import { updateSessionProfile } from '../features/tracking/firebaseClient';

const EmergencyContext = createContext();

// EmailJS credentials (loaded from .env via Vite)
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export function EmergencyProvider({ children }) {
  const [isEmergency, setIsEmergency] = useState(false);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [contactsNotified, setContactsNotified] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState(null);
  const { contacts, user } = useAuth();

  /**
   * Reverse-geocode lat/lng to a human-readable address using Nominatim.
   * Free, no key. We don't await this in the alert flow — the email
   * sends immediately with whatever address (or raw coords) is ready.
   */
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
        { headers: { 'User-Agent': 'SafeHer/1.0' } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.display_name || null;
    } catch {
      return null;
    }
  };

  const activateSOS = async () => {
    if (isEmergency) return;
    setIsEmergency(true);

    // 1. Vibrate (if supported)
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }

    // 2. Get Location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(loc);

          // Kick off reverse geocoding in parallel — UI updates when ready.
          reverseGeocode(loc.lat, loc.lng).then(setAddress);

          await sendAlertEmail(loc);
        },
        async (error) => {
          console.error('Location error:', error);
          await sendAlertEmail(null); // Send email anyway even without location
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      await sendAlertEmail(null);
    }
  };

  const cancelSOS = () => {
    setIsEmergency(false);
    setContactsNotified(false);
    setLocation(null);
    setAddress(null);
    setTrackingUrl(null);
  };

  /**
   * Sends one SOS email per trusted contact that has an email address.
   * Each contact gets a personalized email (to_name, to_email, tracking link
   * tied to the SOS session). The EmailJS template uses {{variables}} like
   * to_name, from_name, from_phone, time, location_address, tracking_link.
   *
   * The session ID is reused across all contacts in this SOS so the
   * tracking page can show a single live feed.
   */
  const sendAlertEmail = async (loc) => {
    // Build a stable session ID for this SOS — reused for tracking.
    const sessionId = api.sessionId();

    const trackingBase = `${window.location.origin}/track`;
    const link = loc
      ? `${trackingBase}?session=${encodeURIComponent(sessionId)}&lat=${loc.lat}&lng=${loc.lng}`
      : `${trackingBase}?session=${encodeURIComponent(sessionId)}`;

    setTrackingUrl(link);

    const formattedTime = new Date().toLocaleString('en-BD', {
      timeZone: 'Asia/Dhaka',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const locationAddress =
      address ||
      (loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : 'Location unavailable');

    // Push profile (name + photo URL + phone) into the same Firebase
    // node as the live location, so /track can show "It's really Nadia"
    // alongside the map marker. This is best-effort — if Firebase
    // isn't configured, the rest of the SOS flow still works.
    try {
      updateSessionProfile(sessionId, {
        name: user?.name,
        photoUrl: user?.photo_url,
        phone: user?.phone,
      });
    } catch (err) {
      console.warn('Failed to push profile to Firebase:', err);
    }

    // Notify contacts that have email addresses (EmailJS needs an email target).
    const emailContacts = (contacts || []).filter((c) => c.email && c.email.trim());

    console.log('===============================');
    console.log(`🚨 SOS ACTIVATED FOR ${user?.name} 🚨`);
    console.log(`📍 Location: ${loc ? `${loc.lat}, ${loc.lng}` : 'Unavailable'}`);
    console.log(`🔗 Tracking: ${link}`);
    console.log(`👥 Notifying ${emailContacts.length} email contacts (of ${contacts?.length || 0} total)`);
    console.log('===============================');

    if (emailContacts.length === 0) {
      // No email contacts — still mark as notified so UI updates, but skip the network call.
      setTimeout(() => setContactsNotified(true), 800);
      return;
    }

    // Send in parallel; ignore per-contact failures so one bad address doesn't block the rest.
    const sendJobs = emailContacts.map(async (contact) => {
      const templateParams = {
        to_name:          contact.name,
        to_email:         contact.email,
        from_name:        user?.name || 'A SafeHer user',
        from_phone:       user?.phone || '—',
        time:             formattedTime,
        location_address: locationAddress,
        tracking_link:    link,
      };

      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          templateParams,
          { publicKey: EMAILJS_PUBLIC_KEY }
        );
        console.log(`✓ SOS email sent to ${contact.name} <${contact.email}>`);
      } catch (err) {
        console.error(`✗ Failed to email ${contact.name}:`, err);
      }
    });

    await Promise.allSettled(sendJobs);
    setContactsNotified(true);
  };

  return (
    <EmergencyContext.Provider
      value={{
        isEmergency,
        activateSOS,
        cancelSOS,
        location,
        address,
        contactsNotified,
        trackingUrl,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
}

export const useEmergency = () => useContext(EmergencyContext);