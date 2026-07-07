import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Loader2, ArrowRight, ChevronRight } from 'lucide-react';
import './auth.css';

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
    <div className="auth">
      {/* Left: editorial brand panel */}
      <aside className="auth__panel" aria-hidden="true">
        <Link to="/" className="auth__brand">
          <span className="auth__brand-mark">
            <ShieldCheck size={14} strokeWidth={2.25} />
          </span>
          SafeHer
        </Link>

        <div className="auth__panel-body">
          <div className="eyebrow">Get started</div>
          <h2 className="auth__panel-title">
            Build your <em>trusted circle</em><br />before you need it.
          </h2>
          <p className="auth__panel-text">
            Add the people who should know when you&rsquo;re unsafe — family, friends, a coworker who walks
            the same road home. Three contacts is enough. Twenty is better.
          </p>

          <ul className="auth__panel-list">
            <li><span className="auth__panel-dot" /> No phone number required</li>
            <li><span className="auth__panel-dot" /> No app to install for your circle</li>
            <li><span className="auth__panel-dot" /> Anonymous incident reports stay anonymous</li>
          </ul>
        </div>

        <div className="auth__panel-foot">
          <span className="auth__panel-foot-meta">v0.1 · CUET SciBlitz</span>
          <span className="auth__panel-foot-meta">© {new Date().getFullYear()}</span>
        </div>
      </aside>

      {/* Right: form */}
      <main className="auth__main">
        <div className="auth__form-wrap">
          <Link to="/" className="auth__home-link">
            ← Back to home
          </Link>

          <header className="auth__form-head">
            <h1 className="auth__title">Create account</h1>
            <p className="auth__sub">It takes about a minute.</p>
          </header>

          {error && (
            <div className="auth__error" role="alert">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="auth__form">
            <div className="auth__field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                required
                className="input-field"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoComplete="name"
              />
            </div>
            <div className="auth__field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                className="input-field"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                autoComplete="email"
              />
            </div>
            <div className="auth__field">
              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                type="tel"
                required
                className="input-field"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                autoComplete="tel"
              />
            </div>
            <div className="auth__field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                className="input-field"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ minHeight: 44, marginTop: 'var(--space-2)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Creating account…
                </>
              ) : (
                <>
                  Create account <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="auth__alt">
            Already have an account?{' '}
            <Link to="/login" className="auth__link">
              Sign in <ChevronRight size={12} />
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}