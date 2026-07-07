import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, X, Loader2, Trash2, UserPlus, AlertCircle,
  ChevronLeft, Phone, Mail, Heart, ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';
import '../../pages/AppShell/appshell.css';

/**
 * Circles — Trusted Circles management page.
 *
 * Lets the user create named circles (e.g. "Family", "Friends",
 * "Coworkers"), add members (phone / email / other handle), and
 * remove either a circle or a single member.
 */
export function Circles() {
  const [circles, setCircles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [openCircleId, setOpenCircleId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await api.circles.list();
      setCircles(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(_readError(err, 'Could not load your circles.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (name, color) => {
    try {
      const circle = await api.circles.create({ name, color });
      setCircles(prev => [circle, ...prev]);
      setShowCreateForm(false);
      setOpenCircleId(circle.id);
    } catch (err) {
      setError(_readError(err, 'Could not create circle.'));
    }
  };

  const handleDeleteCircle = async (id) => {
    if (!confirm('Delete this circle? Members will be removed.')) return;
    try {
      await api.circles.delete(id);
      setCircles(prev => prev.filter(c => c.id !== id));
      if (openCircleId === id) setOpenCircleId(null);
    } catch (err) {
      setError(_readError(err, 'Could not delete circle.'));
    }
  };

  if (openCircleId) {
    const circle = circles.find(c => c.id === openCircleId);
    if (circle) {
      return (
        <CircleDetail
          circle={circle}
          onBack={() => setOpenCircleId(null)}
          onDelete={() => handleDeleteCircle(circle.id)}
          onUpdated={(updated) => {
            setCircles(prev => prev.map(c => c.id === updated.id ? updated : c));
          }}
        />
      );
    }
  }

  return (
    <div className="appshell__scroll animate-fade-in">
      <div className="appshell__page-head">
        <div>
          <div className="eyebrow">Circles</div>
          <h2 className="appshell__page-title">Trusted Circles</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.375rem', lineHeight: 1.5 }}>
            Groups of contacts who get notified when you activate SOS.
          </p>
        </div>
        {!showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            <Plus size={14} /> New Circle
          </button>
        )}
      </div>

      {error && (
        <div className="auth__error" role="alert">{error}</div>
      )}

      {showCreateForm && (
        <CreateCircleForm
          onCancel={() => setShowCreateForm(false)}
          onCreate={handleCreate}
        />
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : circles.length === 0 ? (
        <EmptyState onCreate={() => setShowCreateForm(true)} />
      ) : (
        <div className="appshell__list">
          {circles.map(c => (
            <CircleRow
              key={c.id}
              circle={c}
              onOpen={() => setOpenCircleId(c.id)}
              onDelete={() => handleDeleteCircle(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function CreateCircleForm({ onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4A6D47');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const PALETTE = ['#0A1D08', '#4A6D47', '#2F6F3E', '#A06A12', '#6B7B68', '#B91C1C'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (trimmed.length > 80) { setError('Name must be 80 characters or fewer.'); return; }
    setIsSubmitting(true);
    try {
      await onCreate(trimmed, color);
    } catch (err) {
      setError(_readError(err, 'Could not create circle.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="appshell__card appshell__form">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
        <h4 className="appshell__form-title">New trusted circle</h4>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="appshell__icon-btn">
          <X size={14} />
        </button>
      </div>

      <div className="appshell__form-grid">
        <input
          autoFocus
          required
          maxLength={80}
          placeholder="Circle name (e.g. Family, Friends, Coworkers)"
          className="input-field"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isSubmitting}
        />
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Accent
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Pick color ${c}`}
                aria-pressed={color === c}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border)',
                  outline: color === c ? '2px solid var(--color-bg-primary)' : 'none',
                  outlineOffset: -3,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'transform 150ms',
                  transform: color === c ? 'scale(1.1)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
        {error && <div className="auth__error" style={{ marginBottom: 0 }}>{error}</div>}
        <div className="appshell__form-actions">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : 'Create Circle'}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
        </div>
      </div>
    </form>
  );
}

function CircleRow({ circle, onOpen, onDelete }) {
  const memberCount = circle.member_count ?? 0;
  return (
    <div
      className="appshell__row"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      aria-label={`Open ${circle.name} circle`}
      style={{ cursor: 'pointer' }}
    >
      <div className="appshell__row-avatar" style={{ background: circle.color || 'var(--color-accent)', color: 'var(--color-text-on-accent)' }} aria-hidden="true">
        <Users size={16} />
      </div>
      <div className="appshell__row-info">
        <p className="appshell__row-name">{circle.name}</p>
        <p className="appshell__row-meta">{memberCount} {memberCount === 1 ? 'member' : 'members'}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={`Delete ${circle.name}`}
        className="appshell__icon-btn"
      >
        <Trash2 size={14} />
      </button>
      <ChevronRight size={16} color="var(--color-text-muted)" />
    </div>
  );
}

function CircleDetail({ circle, onBack, onDelete, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.circles.get(circle.id);
      setDetail(data);
      onUpdated?.({ ...circle, member_count: data?.member_count ?? 0 });
    } catch (err) {
      setError(_readError(err, 'Could not load circle.'));
    } finally {
      setIsLoading(false);
    }
  }, [circle, onUpdated]);

  useEffect(() => { load(); }, [load]);

  const handleAddMember = async ({ name, contact, relation }) => {
    await api.circles.addMember(circle.id, { name, contact, relation });
    await load();
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this member from the circle?')) return;
    try {
      await api.circles.removeMember(circle.id, memberId);
      await load();
    } catch (err) {
      setError(_readError(err, 'Could not remove member.'));
    }
  };

  return (
    <div className="appshell__scroll animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          fontSize: '0.8125rem',
          marginBottom: 'var(--space-2)',
          padding: 0,
          transition: 'color 150ms',
        }}
      >
        <ChevronLeft size={14} /> All Circles
      </button>

      <div className="appshell__card appshell__card--user" style={{ marginBottom: 'var(--space-2)' }}>
        <div className="appshell__avatar" style={{ background: circle.color || 'var(--color-accent)', color: 'var(--color-text-on-accent)' }} aria-hidden="true">
          <Users size={20} />
        </div>
        <div className="appshell__user-info">
          <h2 className="appshell__user-name">{circle.name}</h2>
          <p className="appshell__user-meta">
            {detail?.members?.length ?? circle.member_count ?? 0} members
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete circle"
          className="appshell__icon-btn"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {error && (
        <div className="auth__error" role="alert">{error}</div>
      )}

      {!showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="btn btn-primary"
          style={{ minHeight: 44 }}
        >
          <UserPlus size={14} /> Add member
        </button>
      )}

      {showAdd && (
        <AddMemberForm
          onCancel={() => setShowAdd(false)}
          onAdd={async (member) => {
            try {
              await handleAddMember(member);
              setShowAdd(false);
            } catch (err) {
              setError(_readError(err, 'Could not add member.'));
            }
          }}
        />
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="appshell__list">
          {(detail?.members ?? []).length === 0 ? (
            <p className="appshell__empty">
              No members yet — add the people you trust to be alerted when you activate SOS.
            </p>
          ) : (
            (detail?.members ?? []).map(m => (
              <MemberRow key={m.id} member={m} onRemove={() => handleRemoveMember(m.id)} />
            ))
          )}
        </div>
      )}

      <p className="appshell__hint">
        Members of this circle will be alerted when you activate SOS from the SOS tab.
      </p>
    </div>
  );
}

function AddMemberForm({ onCancel, onAdd }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [relation, setRelation] = useState('Friend');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const RELATIONS = ['Family', 'Friend', 'Partner', 'Coworker', 'Neighbor', 'Other'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!contact.trim()) { setError('Contact (phone or email) is required.'); return; }
    setIsSubmitting(true);
    try {
      await onAdd({ name: name.trim(), contact: contact.trim(), relation });
    } catch (err) {
      setError(_readError(err, 'Could not add member.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="appshell__card appshell__form">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
        <h4 className="appshell__form-title">New member</h4>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="appshell__icon-btn">
          <X size={14} />
        </button>
      </div>
      <div className="appshell__form-grid">
        <input
          autoFocus
          required
          maxLength={80}
          placeholder="Name"
          className="input-field"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isSubmitting}
        />
        <input
          required
          maxLength={120}
          placeholder="Phone, email, or other contact"
          className="input-field"
          value={contact}
          onChange={e => setContact(e.target.value)}
          disabled={isSubmitting}
        />
        <select
          className="input-field"
          value={relation}
          onChange={e => setRelation(e.target.value)}
          disabled={isSubmitting}
        >
          {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {error && <div className="auth__error" style={{ marginBottom: 0 }}>{error}</div>}
        <div className="appshell__form-actions">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : 'Save'}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
        </div>
      </div>
    </form>
  );
}

function MemberRow({ member, onRemove }) {
  const isEmail = String(member.contact || '').includes('@');
  return (
    <div className="appshell__row">
      <div className="appshell__row-avatar" aria-hidden="true">
        {isEmail ? <Mail size={14} /> : <Phone size={14} />}
      </div>
      <div className="appshell__row-info">
        <p className="appshell__row-name">{member.name}</p>
        <p className="appshell__row-meta">{member.contact}</p>
        {member.relation && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Heart size={9} /> {member.relation}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${member.name}`}
        className="appshell__icon-btn"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="appshell__card" style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-6)' }}>
      <div className="appshell__avatar" style={{ margin: '0 auto var(--space-4) auto' }} aria-hidden="true">
        <AlertCircle size={20} />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 400, letterSpacing: '-0.015em', color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>
        No trusted circles yet
      </h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
        Create your first circle to group people you trust — family, friends, or coworkers.
      </p>
      <button type="button" onClick={onCreate} className="btn btn-primary">
        <Plus size={14} /> Create your first circle
      </button>
    </div>
  );
}

/** Pull a user-friendly message out of an API error. */
function _readError(err, fallback) {
  try {
    if (err && err.body) {
      const parsed = JSON.parse(err.body);
      if (typeof parsed?.detail === 'string') return parsed.detail;
    }
  } catch (_) { /* ignore */ }
  return err?.message || fallback;
}