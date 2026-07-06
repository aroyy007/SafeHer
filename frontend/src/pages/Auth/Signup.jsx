import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Loader2 } from 'lucide-react';

export function Signup() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Client-side disposable-email hint — server is still the source of truth.
    const disposableHint = _checkDisposableClient(formData.email);
    if (disposableHint) {
      setError(disposableHint);
      setIsLoading(false);
      return;
    }

    try {
      await signup(formData);
      navigate('/app/sos');
    } catch (err) {
      let msg = 'Signup failed';
      try {
        if (err && err.body) msg = JSON.parse(err.body).detail || msg;
      } catch (_) {}
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Small client-side guard so users get feedback before a network round-trip.
  // The server has the real blocklist — this is only a UX hint.
  function _checkDisposableClient(email) {
    if (!email) return null;
    const BLOCKLIST = [
      'mailinator.com','tempmail.com','10minutemail.com','guerrillamail.com',
      'yopmail.com','throwawaymail.com','maildrop.cc','trashmail.com',
      'fakeinbox.com','getnada.com','sharklasers.com','dispostable.com',
    ];
    const domain = email.trim().toLowerCase().split('@')[1] || '';
    if (BLOCKLIST.includes(domain)) {
      return 'Disposable / temporary email addresses are not allowed. Please use a permanent email.';
    }
    return null;
  }

  return (
    <div className="flex-center" style={{ minHeight: '100dvh', padding: '1rem', background: 'var(--color-bg-primary)' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <ShieldCheck size={48} color="var(--color-brand)" style={{ margin: '0 auto 1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Create Account</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Join SafeHer</p>
        </div>

        {error && <div style={{ color: 'var(--color-danger)', textAlign: 'center', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Full Name</label>
            <input type="text" required className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Email</label>
            <input type="email" required className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Phone Number</label>
            <input type="tel" required className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Password</label>
            <input type="password" required className="input-field" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', padding: '0.75rem' }} disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : "Sign Up"}
          </button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-brand)' }}>Log In</Link>
        </p>
      </div>
    </div>
  );
}
