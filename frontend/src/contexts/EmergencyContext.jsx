import React, { createContext, useContext, useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';

const EmergencyContext = createContext();

export function EmergencyProvider({ children }) {
  const [isEmergency, setIsEmergency] = useState(false);
  const [location, setLocation] = useState(null);
  const [contactsNotified, setContactsNotified] = useState(false);

  const activateSOS = () => {
    if (isEmergency) return;
    setIsEmergency(true);
    
    // 1. Vibrate (if supported)
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500]);
    }

    // 2. Get Location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(loc);
          sendAlertEmail(loc);
        },
        (error) => {
          console.error("Location error:", error);
          sendAlertEmail(null); // Send email anyway even without location
        },
        { enableHighAccuracy: true }
      );
    } else {
      sendAlertEmail(null);
    }
  };

  const cancelSOS = () => {
    setIsEmergency(false);
    setContactsNotified(false);
    setLocation(null);
  };

  const sendAlertEmail = async (loc) => {
    // Note: To make this work, you need to replace with your EmailJS credentials
    // SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY
    
    // Mocking email send for now to avoid crashing without keys
    console.log("SENDING SOS EMAIL...", loc);
    setTimeout(() => {
      setContactsNotified(true);
    }, 1500);

    /* Real implementation:
    try {
      const templateParams = {
        to_name: "Trusted Contacts",
        message: `EMERGENCY ALERT. I need help. ${loc ? `Live location: https://safeher.app/track?lat=${loc.lat}&lng=${loc.lng}` : 'Location unavailable.'}`,
        time: new Date().toLocaleTimeString()
      };
      
      await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams, 'YOUR_PUBLIC_KEY');
      setContactsNotified(true);
    } catch (err) {
      console.error('Failed to send email', err);
    }
    */
  };

  return (
    <EmergencyContext.Provider value={{ isEmergency, activateSOS, cancelSOS, location, contactsNotified }}>
      {children}
    </EmergencyContext.Provider>
  );
}

export const useEmergency = () => useContext(EmergencyContext);
