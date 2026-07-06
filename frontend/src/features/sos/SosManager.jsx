import React, { useState, useRef, useEffect } from 'react';
import { useEmergency } from '../../contexts/EmergencyContext';
import { AlertCircle, CheckCircle2, Phone, X } from 'lucide-react';

export function SosManager() {
  const { isEmergency, activateSOS, cancelSOS, contactsNotified } = useEmergency();
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef(null);
  const holdIntervalRef = useRef(null);
  
  const HOLD_DURATION = 3000; // 3 seconds

  const startHold = () => {
    if (isEmergency) return;
    
    // Animate progress ring
    let elapsed = 0;
    holdIntervalRef.current = setInterval(() => {
      elapsed += 50;
      setHoldProgress(Math.min((elapsed / HOLD_DURATION) * 100, 100));
    }, 50);

    // Trigger SOS after duration
    holdTimerRef.current = setTimeout(() => {
      clearInterval(holdIntervalRef.current);
      setHoldProgress(100);
      activateSOS();
    }, HOLD_DURATION);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  if (isEmergency) {
    return (
      <div className="absolute-fill flex-center animate-fade-in" style={{
        backgroundColor: 'var(--color-danger)', 
        flexDirection: 'column',
        zIndex: 100,
        padding: '2rem'
      }}>
        <AlertCircle size={80} color="white" className="animate-pulse-danger" style={{ marginBottom: '2rem' }} />
        
        <h1 style={{ color: 'white', marginBottom: '0.5rem', fontSize: '2rem' }}>SOS ACTIVATED</h1>
        
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          width: '100%',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          {contactsNotified ? (
            <div className="flex-center" style={{ gap: '0.5rem', color: 'white' }}>
              <CheckCircle2 /> <span>Trusted contacts notified</span>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>Notifying contacts...</div>
          )}
        </div>

        <button 
          className="btn" 
          style={{ 
            background: 'white', 
            color: 'var(--color-danger)', 
            width: '100%',
            marginBottom: '1rem',
            padding: '1rem',
            fontSize: '1.25rem'
          }}
        >
          <Phone /> CALL 999
        </button>

        <button 
          className="btn btn-ghost" 
          onClick={cancelSOS}
          style={{ color: 'white', opacity: 0.8 }}
        >
          <X /> Cancel SOS
        </button>
      </div>
    );
  }

  // Normal view
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>Hold for 3 seconds to activate SOS</p>
      
      <div 
        className="sos-button-container" 
        style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto' }}
      >
        {/* Progress Ring */}
        <svg 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }} 
          viewBox="0 0 100 100"
        >
          <circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke="var(--color-bg-tertiary)" 
            strokeWidth="5" 
          />
          <circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke="var(--color-danger)" 
            strokeWidth="5"
            strokeDasharray="283"
            strokeDashoffset={283 - (283 * holdProgress) / 100}
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>

        {/* Button */}
        <button
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-danger)',
            color: 'white',
            fontSize: '2rem',
            fontWeight: 'bold',
            boxShadow: 'var(--shadow-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          SOS
        </button>
      </div>
    </div>
  );
}
