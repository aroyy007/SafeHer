import React, { useState } from 'react';
import { NavLink, useLocation, Navigate } from 'react-router-dom';
import { ShieldAlert, Map as MapIcon, MessageCircle, User, Users, LogOut, Trash2, Plus } from 'lucide-react';
import { EmergencyProvider } from '../../contexts/EmergencyContext';
import { SosManager } from '../../features/sos/SosManager';
import { DisguiseMode } from '../../features/sos/DisguiseMode';
import { VoiceTrigger } from '../../features/sos/VoiceTrigger';
import { LocationTracker } from '../../features/tracking/LocationTracker';
import { MapContainer } from '../../features/map/MapContainer';
import { SafetyChat } from '../../features/chat/SafetyChat';
import { Circles } from '../Circles/Circles';
import { useAuth } from '../../contexts/AuthContext';
import './appshell.css';

/**
 * AppShell — the main in-app experience with the 5-tab bottom nav.
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

        {/* Header — discreet triple-tap target */}
        <header onClick={handleHeaderTap} className="appshell__header">
          <h1 className="appshell__brand">SafeHer</h1>
        </header>

        {/* Main Content — keyed by route so it re-renders cleanly on tab change */}
        <main className="content-area" key={location.pathname}>
          {location.pathname === '/app' && <Navigate to="/app/sos" replace />}
          {location.pathname === '/app/sos' && (
            <div className="appshell__tab flex-center animate-fade-in">
              <SosManager />
            </div>
          )}
          {location.pathname === '/app/map' && (
            <div className="appshell__tab appshell__tab--bleed">
              <MapContainer />
            </div>
          )}
          {location.pathname === '/app/chat' && (
            <div className="appshell__tab appshell__tab--bleed">
              <SafetyChat />
            </div>
          )}
          {location.pathname === '/app/circles' && (
            <div className="appshell__tab appshell__tab--scroll">
              <Circles />
            </div>
          )}
          {location.pathname === '/app/you' && (
            <div className="appshell__tab appshell__tab--scroll">
              <YouTab />
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="bottom-nav" aria-label="Primary">
          <NavItem to="/app/sos" label="SOS" icon={<ShieldAlert size={20} strokeWidth={1.75} />} />
          <NavItem to="/app/map" label="Map" icon={<MapIcon size={20} strokeWidth={1.75} />} />
          <NavItem to="/app/chat" label="Chat" icon={<MessageCircle size={20} strokeWidth={1.75} />} />
          <NavItem to="/app/circles" label="Circles" icon={<Users size={20} strokeWidth={1.75} />} />
          <NavItem to="/app/you" label="You" icon={<User size={20} strokeWidth={1.75} />} />
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
    <div className="appshell__scroll">
      <div className="appshell__page-head">
        <div>
          <span className="eyebrow">Profile</span>
          <h2 className="appshell__page-title">You</h2>
        </div>
        <button onClick={logout} className="btn btn-ghost" style={{ color: 'var(--color-danger)' }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      {user && (
        <div className="appshell__card appshell__card--user">
          <div className="appshell__avatar" aria-hidden="true">
            {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="appshell__user-info">
            <h3 className="appshell__user-name">{user.name || 'Anonymous'}</h3>
            <p className="appshell__user-meta">{user.email}</p>
            <p className="appshell__user-meta">{user.phone}</p>
          </div>
        </div>
      )}

      <div className="appshell__section-head">
        <h3 className="appshell__section-title">Emergency contacts</h3>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary" style={{ minHeight: 36, padding: '0.4rem 0.875rem', fontSize: '0.8125rem' }}>
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddContact} className="appshell__card appshell__form">
          <h4 className="appshell__form-title">New contact</h4>
          <div className="appshell__form-grid">
            <input required placeholder="Name" className="input-field" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
            <input required placeholder="Phone" type="tel" className="input-field" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
            <input placeholder="Email (strongly recommended)" type="email" className="input-field" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#888' }}>
            SOS alerts send by email so the contact receives your live tracking
            link even when SMS is blocked. Phone alone works for voice calls but
            not for the tracking link.
          </p>
          <div className="appshell__form-actions">
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      <div className="appshell__list">
        {contacts.length === 0 && !showAddForm ? (
          <p className="appshell__empty">No emergency contacts added yet.</p>
        ) : (
          contacts.map(c => (
            <div key={c.id} className="appshell__row">
              <div className="appshell__row-avatar" aria-hidden="true">
                {(c.name || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="appshell__row-info">
                <p className="appshell__row-name">{c.name}</p>
                <p className="appshell__row-meta">
                  {c.phone}
                  {c.email ? ` · ${c.email}` : ' · ⚠ no email (tracking link will not be delivered)'}
                </p>
              </div>
              <button onClick={() => deleteContact(c.id)} className="appshell__icon-btn" aria-label={`Delete ${c.name}`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
      <p className="appshell__hint">
        These contacts will be automatically notified when you activate SOS.
      </p>
    </div>
  );
}