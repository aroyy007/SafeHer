import React, { useState, useRef, useEffect } from 'react';
import { useEmergency } from '../../contexts/EmergencyContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AlertCircle, CheckCircle2, Phone, X } from 'lucide-react';
import './sos.css';

export function SosManager() {
  const { isEmergency, activateSOS, cancelSOS, notificationStatus, trackingUrl } = useEmergency();
  const { t } = useLanguage();
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef(null);
  const holdIntervalRef = useRef(null);

  const HOLD_DURATION = 3000; // 3 seconds

  const startHold = () => {
    if (isEmergency || holdTimerRef.current) return;
    let elapsed = 0;
    holdIntervalRef.current = setInterval(() => {
      elapsed += 50;
      setHoldProgress(Math.min((elapsed / HOLD_DURATION) * 100, 100));
    }, 50);

    holdTimerRef.current = setTimeout(() => {
      clearInterval(holdIntervalRef.current);
      holdTimerRef.current = null;
      holdIntervalRef.current = null;
      setHoldProgress(100);
      activateSOS('button_hold');
    }, HOLD_DURATION);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdTimerRef.current = null;
    holdIntervalRef.current = null;
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

        <h1 className="sos-active__title">{t('SOS activated')}</h1>
        <p className="sos-active__sub">{t('SOS is active. Call 999 if you need immediate help.')}</p>

        <div className="sos-active__status">
          {notificationStatus === 'sending' && <span className="sos-active__status-pending">{t('Sending alerts…')}</span>}
          {notificationStatus === 'sent' && <span><CheckCircle2 size={14} /> {t('Alerts sent to trusted contacts')}</span>}
          {notificationStatus === 'partial' && <span><AlertCircle size={14} /> {t('Some alerts could not be sent')}</span>}
          {notificationStatus === 'failed' && <span><AlertCircle size={14} /> {t('Alert delivery failed. Call 999.')}</span>}
          {notificationStatus === 'no_contacts' && <span><AlertCircle size={14} /> {t('No email contacts are saved. Call 999.')}</span>}
        </div>

        {trackingUrl && <a className="sos-active__sub" href={trackingUrl}>{t('Open live location link')}</a>}

        <div className="sos-active__actions">
          <a href="tel:999" className="btn btn-primary sos-active__call" style={{ backgroundColor: 'var(--color-danger)' }}>
            <Phone size={16} /> {t('Call 999')}
          </a>
          <button onClick={cancelSOS} className="btn btn-ghost" style={{ color: 'white' }}>
            <X size={14} /> {t('Cancel SOS')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sos">
      <div className="sos__head">
        <div className="eyebrow">{t('Emergency')}</div>
        <h2 className="sos__title">{t('Press & hold the button.')}</h2>
        <p className="sos__sub">
          {t('Hold for')} <strong>{t('3 seconds')}</strong> {t('to alert configured contacts. Location sharing starts with SOS when access is available. Voice trigger depends on browser support and microphone access.')}
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
          type="button"
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={(event) => {
            if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
              event.preventDefault();
              startHold();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === ' ' || event.key === 'Enter') cancelHold();
          }}
          onBlur={cancelHold}
          className="sos__button"
          aria-label={t('Hold for 3 seconds to activate SOS')}
        >
          <span className="sos__button-eyebrow">{t('Hold')}</span>
          <span className="sos__button-text">SOS</span>
        </button>
      </div>

      <div className="sos__footer">
        <div className="sos__footer-item">
          <span className="sos__footer-dot" />
          {t('Email alerts need a saved contact email')}
        </div>
        <div className="sos__footer-item">
          <span className="sos__footer-dot sos__footer-dot--accent" />
          {t('Location shares during an active SOS')}
        </div>
      </div>
    </div>
  );
}
