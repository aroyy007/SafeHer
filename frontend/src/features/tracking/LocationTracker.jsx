import React, { useEffect, useRef } from 'react';
import { useEmergency } from '../../contexts/EmergencyContext';
import { isFirebaseReady, updateLiveLocation } from './firebaseClient';

export function LocationTracker() {
  const { isEmergency, location } = useEmergency();
  const trackingInterval = useRef(null);

  // Sync location to Firebase every 5 seconds if SOS is active
  useEffect(() => {
    if (!isEmergency || !isFirebaseReady || !location) {
      if (trackingInterval.current) clearInterval(trackingInterval.current);
      return;
    }

    const syncLocation = () => {
      // Get fresh location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateLiveLocation('demo_user_1', position.coords.latitude, position.coords.longitude);
            console.log("Synced location to Firebase");
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

    return () => {
      if (trackingInterval.current) clearInterval(trackingInterval.current);
    };
  }, [isEmergency, location]);

  return null; // Background component
}
