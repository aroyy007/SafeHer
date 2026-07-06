import React, { useEffect, useRef } from 'react';
import { useEmergency } from '../../contexts/EmergencyContext';

export function VoiceTrigger() {
  const { activateSOS, isEmergency } = useEmergency();
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (isEmergency) return; // Don't keep listening if already triggered
    
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return;
    }

    try {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'bn-BD'; // Default to Bengali

      const triggerWords = ['bachao', 'help', 'বাঁচাও', 'emergency'];

      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript.toLowerCase();
        }
        
        console.log("Voice transcript:", transcript);
        
        // Check for trigger words
        const isTriggered = triggerWords.some(word => transcript.includes(word));
        if (isTriggered) {
          console.log("🚨 VOICE TRIGGER ACTIVATED 🚨");
          activateSOS();
          recognitionRef.current.stop();
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
      };

      recognitionRef.current.onend = () => {
        // Auto-restart to keep listening
        if (!isEmergency && recognitionRef.current) {
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (e) {
              // Ignore if already started
            }
          }, 1500);
        }
      };

      recognitionRef.current.start();
      console.log("Voice trigger listening...");

    } catch (err) {
      console.error("Failed to initialize voice trigger:", err);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isEmergency, activateSOS]);

  return null; // This component has no UI, it just runs in the background
}
