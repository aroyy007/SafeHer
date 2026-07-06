import React, { useState } from 'react';
import { NavLink, useLocation, Navigate } from 'react-router-dom';
import { ShieldAlert, Map as MapIcon, MessageCircle, User } from 'lucide-react';
import { EmergencyProvider } from '../../contexts/EmergencyContext';
import { SosManager } from '../../features/sos/SosManager';
import { DisguiseMode } from '../../features/sos/DisguiseMode';
import { VoiceTrigger } from '../../features/sos/VoiceTrigger';
import { LocationTracker } from '../../features/tracking/LocationTracker';
import { MapContainer } from '../../features/map/MapContainer';
import { SafetyChat } from '../../features/chat/SafetyChat';

/**
 * AppShell — the main in-app experience with the 4-tab bottom nav.
 * Mounted on /app/sos, /app/map, /app/chat, /app/you.
 * Wraps everything in EmergencyProvider so the VoiceTrigger can fire
 * the global SOS state.
 */
export function AppShell() {
  const [isDisguised, setIsDisguised] = useState(false);
  const [headerTaps, setHeaderTaps] = useState(0);
  const location = useLocation();

  // Triple-tap logic for disguise
  const handleHeaderTap = () => {
    setHeaderTaps((prev) => prev + 1);
    window.setTimeout(() => setHeaderTaps(0), 1000);
    if (headerTaps === 2) {
      setIsDisguised(true);
      setHeaderTaps(0);
    }
  };

  if (isDisguised) {
    return (
      <EmergencyProvider>
        <DisguiseMode onExit={() => setIsDisguised(false)} />
      </EmergencyProvider>
    );
  }

  return (
    <EmergencyProvider>
      <div className="app-shell">
        <VoiceTrigger />
        <LocationTracker />

        {/* Header — discreet triple-tap target (hint removed for disguise safety) */}
        <header
          onClick={handleHeaderTap}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            textAlign: 'center',
            borderBottom: '1px solid var(--color-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            cursor: 'default',
            userSelect: 'none',
          }}
        >
          <h1
            style={{
              color: 'var(--color-brand)',
              fontSize: '1.125rem',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em',
            }}
          >
            SafeHer
          </h1>
        </header>

        {/* Main Content — keyed by route so it re-renders cleanly on tab change */}
        <main className="content-area" key={location.pathname}>
          {location.pathname === '/app' && <Navigate to="/app/sos" replace />}
          {location.pathname === '/app/sos' && (
            <div className="flex-center animate-fade-in" style={{ height: '100%', flexDirection: 'column' }}>
              <SosManager />
            </div>
          )}
          {location.pathname === '/app/map' && (
            <div style={{ height: '100%', width: '100%' }}>
              <MapContainer />
            </div>
          )}
          {location.pathname === '/app/chat' && (
            <div style={{ height: '100%', width: '100%' }}>
              <SafetyChat />
            </div>
          )}
          {location.pathname === '/app/you' && <YouTab />}
        </main>

        {/* Bottom Navigation */}
        <nav className="bottom-nav" aria-label="Primary">
          <NavItem to="/app/sos" label="SOS" icon={<ShieldAlert size={22} strokeWidth={1.75} />} />
          <NavItem to="/app/map" label="Map" icon={<MapIcon size={22} strokeWidth={1.75} />} />
          <NavItem to="/app/chat" label="Chat" icon={<MessageCircle size={22} strokeWidth={1.75} />} />
          <NavItem to="/app/you" label="You" icon={<User size={22} strokeWidth={1.75} />} />
        </nav>
      </div>
    </EmergencyProvider>
  );
}

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

/**
 * YouTab — placeholder for the settings/trusted-circle/onboarding screens.
 * Out of scope for this iteration but wired in to keep nav consistent.
 */
function YouTab() {
  return (
    <div className="animate-fade-in" style={{ padding: 'var(--space-6)', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>You</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-6)' }}>
        Settings, trusted contacts, and preferences live here.
      </p>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          The You tab is being built. For now, your trusted contacts and preferences are
          read from your local browser only.
        </p>
      </div>
    </div>
  );
}
