import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';

const CATEGORIES = [
  { value: 'eve_teasing', label: 'Eve-teasing / harassment' },
  { value: 'stalking', label: 'Stalking / being followed' },
  { value: 'physical_assault', label: 'Physical assault' },
  { value: 'rape', label: 'Sexual assault' },
  { value: 'robbery', label: 'Robbery / mugging' },
  { value: 'unsafe_lighting', label: 'Unsafe lighting' },
  { value: 'unsafe_transport', label: 'Unsafe transport' },
  { value: 'other', label: 'Other safety concern' },
];

const TIMES = [
  { value: 'morning', label: 'Morning (6am–12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm–5pm)' },
  { value: 'evening', label: 'Evening (5pm–8pm)' },
  { value: 'night', label: 'Night (8pm–6am)' },
];

/**
 * IncidentReportModal — modal form for reporting a safety incident.
 * Submitting POSTs to /incidents/. Reports are anonymous by default
 * (no name/contact info sent with the report itself — we only attach
 * `session_id` for rate-limiting).
 */
export function IncidentReportModal({ initialCoords, onClose, onReported }) {
  const [category, setCategory] = useState('unsafe_lighting');
  const [timeOfDay, setTimeOfDay] = useState('night');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!initialCoords?.lat || !initialCoords?.lng) {
      setErrorMsg('Location is missing. Please open this from the map page.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.reportIncident({
        lat: initialCoords.lat,
        lng: initialCoords.lng,
        category,
        description: description.trim(),
        time_of_day: timeOfDay,
        anonymous,
      });
      setSuccess(true);
      // Auto-close after showing the success state briefly
      setTimeout(() => {
        onReported?.();
        onClose?.();
      }, 1500);
    } catch (err) {
      setErrorMsg(
        (err && err.body && (() => {
          try { return JSON.parse(err.body).detail; } catch { return null; }
        })()) ||
        err?.message ||
        'Could not submit your report. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state: simple confirmation panel, no form
  if (success) {
    return (
      <ModalShell onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <CheckCircle2 size={56} color="var(--color-success, #10b981)" />
          <h3 style={{ marginTop: '1rem', fontSize: '1.125rem' }}>Report submitted</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Thank you for making the community safer. Your report helps warn other women.
          </p>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={22} color="var(--color-danger)" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Report an incident</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
        >
          <X size={20} />
        </button>
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
        Reports are anonymous by default and help other women avoid unsafe spots.
        Don't include your name or identifying details in the description.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Category
          </label>
          <select
            className="input-field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%' }}
            disabled={isSubmitting}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            When did it happen?
          </label>
          <select
            className="input-field"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
            style={{ width: '100%' }}
            disabled={isSubmitting}
          >
            {TIMES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Description (optional, max 500 chars)
          </label>
          <textarea
            className="input-field"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="What happened? Any landmarks nearby?"
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }}
            disabled={isSubmitting}
          />
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textAlign: 'right', marginTop: '0.25rem' }}>
            {description.length} / 500
          </div>
        </div>

        {initialCoords && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Location: {initialCoords.lat.toFixed(4)}, {initialCoords.lng.toFixed(4)}
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            disabled={isSubmitting}
          />
          Submit anonymously (recommended)
        </label>

        {errorMsg && (
          <div role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.8125rem', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          style={{ padding: '0.75rem', marginTop: '0.25rem' }}
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Submit Report'}
        </button>
      </form>
    </ModalShell>
  );
}

/**
 * ModalShell — shared backdrop + card wrapper so we can reuse it elsewhere.
 */
function ModalShell({ children, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // Click on backdrop closes; clicks inside the card don't bubble.
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 2000,
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.25rem',
          background: 'var(--color-bg-primary, #fff)',
          color: 'var(--color-text-primary)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
