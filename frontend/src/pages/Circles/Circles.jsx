import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, X, Loader2, Trash2, UserPlus, AlertCircle,
  ChevronLeft, Phone, Mail, Heart, ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';

/**
 * Circles — Trusted Circles management page.
 *
 * Lets the user create named circles (e.g. "Family", "Friends",
 * "Coworkers"), add members (phone / email / other handle), and
 * remove either a circle or a single member.
 *
 * Backend identity is the per-device `X-Session-Id` header (already
 * managed by api.js sessionHeaders()), so there's nothing to wire up
 * — open the page and it works.
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
      // Auto-open the new circle so the user can add members right away
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

  // Detail view: one circle expanded with members
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

  // List view
  return (
    <div
      className="animate-fade-in"
      style={{
        padding: 'var(--space-6)',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={22} color="var(--color-brand)" /> Trusted Circles
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Groups of contacts who get notified when you activate SOS.
          </p>
        </div>
        {!showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          >
            <Plus size={16} /> New Circle
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            color: 'var(--color-danger)',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      {showCreateForm && (
        <CreateCircleForm
          onCancel={() => setShowCreateForm(false)}
          onCreate={handleCreate}
        />
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : circles.length === 0 ? (
        <EmptyState onCreate={() => setShowCreateForm(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
  const [color, setColor] = useState('#FF4D6D');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const PALETTE = ['#FF4D6D', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

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
    <form
      onSubmit={handleSubmit}
      className="glass-panel"
      style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>New Trusted Circle</h3>
        <button type="button" onClick={onCancel} aria-label="Cancel" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
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
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.375rem' }}>Color</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Pick color ${c}`}
                aria-pressed={color === c}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '3px solid var(--color-text-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'transform 0.15s',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.8125rem' }}>{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ padding: '0.625rem' }}>
          {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Create Circle'}
        </button>
      </div>
    </form>
  );
}

function CircleRow({ circle, onOpen, onDelete }) {
  const memberCount = circle.member_count ?? 0;
  return (
    <div
      className="glass-panel"
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${circle.name} circle`}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: circle.color || '#FF4D6D',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Users size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{circle.name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={`Delete ${circle.name}`}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0.5rem' }}
      >
        <Trash2 size={16} />
      </button>
      <ChevronRight size={18} color="var(--color-text-muted)" />
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
      // Bubble member count up to the parent list
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
    await load(); // re-fetch to get accurate member list
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
    <div
      className="animate-fade-in"
      style={{ padding: 'var(--space-6)', overflowY: 'auto', height: '100%' }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-brand)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.875rem',
          marginBottom: '1rem',
          padding: 0,
        }}
      >
        <ChevronLeft size={16} /> All Circles
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: 'var(--space-4)' }}>
        <div
          aria-hidden="true"
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: circle.color || '#FF4D6D',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Users size={26} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{circle.name}</h2>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {detail?.members?.length ?? circle.member_count ?? 0} members
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete circle"
          className="btn btn-ghost"
          style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {error && (
        <div role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.625rem', marginBottom: 'var(--space-4)' }}
        >
          <UserPlus size={16} /> Add Member
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {(detail?.members ?? []).length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: '1rem 0' }}>
              No members yet — add the people you trust to be alerted when you activate SOS.
            </p>
          ) : (
            (detail?.members ?? []).map(m => (
              <MemberRow key={m.id} member={m} onRemove={() => handleRemoveMember(m.id)} />
            ))
          )}
        </div>
      )}

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-6)', textAlign: 'center' }}>
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
    <form
      onSubmit={handleSubmit}
      className="glass-panel"
      style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>New Member</h4>
        <button type="button" onClick={onCancel} aria-label="Cancel" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.8125rem' }}>{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ padding: '0.5rem' }}>
          {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Save'}
        </button>
      </div>
    </form>
  );
}

function MemberRow({ member, onRemove }) {
  const isEmail = String(member.contact || '').includes('@');
  return (
    <div
      className="glass-panel"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--color-bg-tertiary, #e5e7eb)',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isEmail ? <Mail size={16} /> : <Phone size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.name}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.contact}
        </div>
        {member.relation && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem' }}>
            <Heart size={10} /> {member.relation}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${member.name}`}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0.5rem' }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '2rem 1.5rem',
        textAlign: 'center',
        marginTop: '1rem',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--color-bg-tertiary, #f3f4f6)',
          color: 'var(--color-text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <AlertCircle size={28} />
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.375rem' }}>No trusted circles yet</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Create your first circle to group people you trust — family, friends, or coworkers.
      </p>
      <button type="button" onClick={onCreate} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
        <Plus size={16} /> Create your first circle
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