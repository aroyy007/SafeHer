import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './pages/AppShell/AppShell';
import { Landing } from './pages/Landing/Landing';
import { Track } from './pages/Track/Track';

/**
 * App.jsx — the router.
 *
 * Routes:
 *   /                  → Landing page (public)
 *   /app               → Redirects to /app/sos
 *   /app/sos           → Main app (SOS tab is the default landing when in-app)
 *   /app/map           → Map tab
 *   /app/chat          → Chat tab
 *   /app/you           → You tab (settings)
 *   /track/:sessionId  → Public read-only tracking page (no app shell, no auth)
 *   *                  → 404 fallback
 *
 * Each route has its own concerns:
 *   - Landing & Tracking: scrollable, no app shell, no EmergencyProvider
 *   - AppShell: full-bleed, EmergencyProvider, bottom nav
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Navigate to="/app/sos" replace />} />
      <Route path="/app/:tab" element={<AppShell />} />
      <Route path="/track/:sessionId" element={<Track />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-6)',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>404</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>This page doesn't exist.</p>
      <a
        href="/"
        style={{
          marginTop: 'var(--space-3)',
          color: 'var(--color-brand)',
          fontWeight: 500,
        }}
      >
        ← Back home
      </a>
    </div>
  );
}

export default App;
