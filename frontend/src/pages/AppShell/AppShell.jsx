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

import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Trash2, Plus } from 'lucide-react';

function YouTab() {
  const { user, contacts, logout, addContact, deleteContact } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', relation: 'Friend' });

  const handleAddContact = async (e) => {
    e.preventDefault();
    await addContact(newContact);
    setShowAddForm(false);
    setNewContact({ name: '', phone: '', email: '', relation: 'Friend' });
  };

  return (
    <div className="animate-fade-in" style={{ padding: 'var(--space-6)', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Profile</h2>
        <button onClick={logout} className="btn btn-ghost" style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      {user && (
        <div className="glass-panel" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>{user.name}</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{user.email}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{user.phone}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Emergency Contacts</h3>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddContact} className="glass-panel" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>New Contact</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input required placeholder="Name" className="input-field" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
            <input required placeholder="Phone" type="tel" className="input-field" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
            <input placeholder="Email (optional)" type="email" className="input-field" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.5rem' }}>Save</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-ghost" style={{ flex: 1, padding: '0.5rem' }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {contacts.length === 0 && !showAddForm ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No emergency contacts added yet.</p>
        ) : (
          contacts.map(c => (
            <div key={c.id} className="glass-panel" style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 500 }}>{c.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.phone}</p>
              </div>
              <button onClick={() => deleteContact(c.id)} style={{ color: 'var(--color-danger)', padding: '0.5rem' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-6)', textAlign: 'center' }}>
        These contacts will be automatically notified when you activate SOS.
      </p>
    </div>
  );
}
