import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './pages/AppShell/AppShell';
import { Landing } from './pages/Landing/Landing';
import { Track } from './pages/Track/Track';
import { Login } from './pages/Auth/Login';
import { Signup } from './pages/Auth/Signup';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/app" element={<ProtectedRoute><Navigate to="/app/sos" replace /></ProtectedRoute>} />
        <Route path="/app/:tab" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
        <Route path="/track/:sessionId" element={<Track />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="flex-center" style={{ minHeight: '100dvh' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
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
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
      }}
    >
      <div className="eyebrow">Error 404</div>
      <h1
        style={{
          fontSize: 'clamp(3rem, 8vw, 5rem)',
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          letterSpacing: '-0.03em',
          color: 'var(--color-text-primary)',
        }}
      >
        Not found.
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9375rem', maxWidth: '320px' }}>
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <a
        href="/"
        className="btn btn-primary"
        style={{ marginTop: 'var(--space-3)', minHeight: 40 }}
      >
        ← Back home
      </a>
    </div>
  );
}

export default App;
