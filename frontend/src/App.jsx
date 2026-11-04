import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AppShell } from './pages/AppShell/AppShell';
import { Landing } from './pages/Landing/Landing';
import { Track } from './pages/Track/Track';
import { Login } from './pages/Auth/Login';
import { Signup } from './pages/Auth/Signup';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';

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
    <LanguageProvider>
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
    </LanguageProvider>
  );
}

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  
  if (isLoading) return <div className="route-loading" role="status"><span>{t('Loading your session…')}</span><LanguageSwitcher /></div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
}

function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="route-not-found">
      <div className="eyebrow">{t('Error 404')}</div>
      <h1>{t('Not found.')}</h1>
      <p>
        {t('The page you’re looking for doesn’t exist or has moved.')}
      </p>
      <LanguageSwitcher />
      <Link to="/" className="btn btn-primary">{t('Back home')}</Link>
    </main>
  );
}

export default App;
