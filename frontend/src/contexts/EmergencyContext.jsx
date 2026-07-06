import React, { createContext, useContext, useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';

import { useAuth } from './AuthContext';

const EmergencyContext = createContext();

export function EmergencyProvider({ children }) {
  const [isEmergency, setIsEmergency] = useState(false);
  const [location, setLocation] = useState(null);
  const [contactsNotified, setContactsNotified] = useState(false);
  const { contacts, user } = useAuth();

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
    // In a real app, this would call the backend which then triggers SendGrid/Twilio.
    // For this hackathon, we simulate it via frontend timeout and console.log
    console.log("===============================");
    console.log(`🚨 SOS ACTIVATED FOR ${user?.name} 🚨`);
    console.log(`📍 Location: ${loc ? `${loc.lat}, ${loc.lng}` : 'Unavailable'}`);
    console.log(`👥 Notifying ${contacts.length} emergency contacts:`);
    contacts.forEach(c => {
      console.log(`   - 📲 SMS to ${c.name}: ${c.phone}`);
      if (c.email) console.log(`   - ✉️ Email to ${c.name}: ${c.email}`);
    });
    console.log("===============================");

    setTimeout(() => {
      setContactsNotified(true);
    }, 1500);

    /* Real implementation example using EmailJS:
    try {
      const templateParams = {
        to_name: contacts.map(c => c.name).join(', '),
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
