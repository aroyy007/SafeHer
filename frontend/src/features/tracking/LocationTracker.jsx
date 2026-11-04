import React, { useEffect, useRef } from 'react';
import { useEmergency } from '../../contexts/EmergencyContext';
import { isFirebaseReady, updateLiveLocation } from './firebaseClient';

export function LocationTracker() {
  const {
    isEmergency,
    location,
    emergencySessionId,
    emergencySessionCreatedAt,
    emergencySessionExpiresAt,
  } = useEmergency();
  const trackingInterval = useRef(null);

  // Sync location to Firebase every 5 seconds if SOS is active
  useEffect(() => {
    if (
      !isEmergency
      || !isFirebaseReady
      || !location
      || !emergencySessionId
      || !Number.isFinite(emergencySessionCreatedAt)
      || !Number.isFinite(emergencySessionExpiresAt)
      || emergencySessionExpiresAt <= Date.now()
    ) {
      if (trackingInterval.current) clearInterval(trackingInterval.current);
      trackingInterval.current = null;
      return;
    }

    let active = true;
    let expiryTimeout = null;
    const stopTracking = () => {
      active = false;
      if (trackingInterval.current) clearInterval(trackingInterval.current);
      if (expiryTimeout) clearTimeout(expiryTimeout);
      trackingInterval.current = null;
    };

    const syncLocation = () => {
      if (Date.now() >= emergencySessionExpiresAt) {
        stopTracking();
        return;
      }

      // Get fresh location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!active || Date.now() >= emergencySessionExpiresAt) return;
            updateLiveLocation(
              emergencySessionId,
              position.coords.latitude,
              position.coords.longitude,
              emergencySessionCreatedAt,
              emergencySessionExpiresAt,
            );
          },
          (err) => console.warn("Failed to get tracking location", err),
          { enableHighAccuracy: true }
        );
      }
    };

    // Immediate sync
    syncLocation();
    
    // Sync every 5 seconds
    trackingInterval.current = setInterval(syncLocation, 5000);
    expiryTimeout = setTimeout(stopTracking, emergencySessionExpiresAt - Date.now());

    return () => {
      stopTracking();
    };
  }, [
    isEmergency,
    location,
    emergencySessionId,
    emergencySessionCreatedAt,
    emergencySessionExpiresAt,
  ]);

  return null; // Background component
}
