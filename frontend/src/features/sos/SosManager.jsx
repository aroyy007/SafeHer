import React, { useState, useRef, useEffect } from 'react';
import { useEmergency } from '../../contexts/EmergencyContext';
import { AlertCircle, CheckCircle2, Phone, X } from 'lucide-react';
import './sos.css';

export function SosManager() {
  const { isEmergency, activateSOS, cancelSOS, contactsNotified } = useEmergency();
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef(null);
  const holdIntervalRef = useRef(null);

  const HOLD_DURATION = 3000; // 3 seconds

  const startHold = () => {
    if (isEmergency) return;
    let elapsed = 0;
    holdIntervalRef.current = setInterval(() => {
      elapsed += 50;
      setHoldProgress(Math.min((elapsed / HOLD_DURATION) * 100, 100));
    }, 50);

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

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  if (isEmergency) {
    return (
      <div className="sos-active animate-fade-in">
        <div className="sos-active__pulse">
          <AlertCircle size={48} className="animate-pulse-danger" />
        </div>

        <h1 className="sos-active__title">SOS activated</h1>
        <p className="sos-active__sub">Trusted contacts are being notified.</p>

        <div className="sos-active__status">
          {contactsNotified ? (
            <span><CheckCircle2 size={14} /> Contacts notified</span>
          ) : (
            <span className="sos-active__status-pending">Notifying contacts…</span>
          )}
        </div>

        <div className="sos-active__actions">
          <a href="tel:999" className="btn btn-primary sos-active__call" style={{ backgroundColor: 'var(--color-danger)' }}>
            <Phone size={16} /> Call 999
          </a>
          <button onClick={cancelSOS} className="btn btn-ghost" style={{ color: 'white' }}>
            <X size={14} /> Cancel SOS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sos">
      <div className="sos__head">
        <div className="eyebrow">Emergency</div>
        <h2 className="sos__title">Press &amp; hold the button.</h2>
        <p className="sos__sub">
          Hold for <strong>3 seconds</strong> to alert your trusted circle and share your live location.
          Or just say <span className="font-bn">&ldquo;বাঁচাও&rdquo;</span>.
        </p>
      </div>

      <div className="sos__button-wrap">
        <svg
          className="sos__ring"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="2"
          />
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth="2"
            strokeDasharray="283"
            strokeDashoffset={283 - (283 * holdProgress) / 100}
            className="sos__ring-progress"
          />
        </svg>

        <button
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          className="sos__button"
          aria-label="Hold for 3 seconds to activate SOS"
        >
          <span className="sos__button-eyebrow">Hold</span>
          <span className="sos__button-text">SOS</span>
        </button>
      </div>

      <div className="sos__footer">
        <div className="sos__footer-item">
          <span className="sos__footer-dot" />
          Voice trigger armed
        </div>
        <div className="sos__footer-item">
          <span className="sos__footer-dot sos__footer-dot--accent" />
          Location live
        </div>
      </div>
    </div>
  );
}