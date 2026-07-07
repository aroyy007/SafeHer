import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Loader2, ArrowRight, ChevronRight } from 'lucide-react';
import './auth.css';

export function Login() {
  const [email, setEmail] = useState('demo@safeher.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/app/sos');
    } catch (err) {
      setError(err.body ? JSON.parse(err.body).detail : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

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
          <div className="eyebrow">Welcome back</div>
          <h2 className="auth__panel-title">
            <em>Three seconds</em><br />to a safer you.
          </h2>
          <p className="auth__panel-text">
            Trusted by your circle, designed for Bangladesh. One hold of the SOS button alerts everyone
            who matters and shares your live location — instantly.
          </p>

          <ul className="auth__panel-list">
            <li>
              <span className="auth__panel-dot" /> Bengali voice trigger — say <span className="font-bn">"বাঁচাও"</span>
            </li>
            <li>
              <span className="auth__panel-dot" /> Crime-aware safe routes
            </li>
            <li>
              <span className="auth__panel-dot" /> Live location sharing — no install on the other end
            </li>
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
            <h1 className="auth__title">Sign in</h1>
            <p className="auth__sub">Continue your safety setup.</p>
          </header>

          {error && (
            <div className="auth__error" role="alert">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="auth__form">
            <div className="auth__field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="auth__field">
              <div className="auth__field-row">
                <label htmlFor="password">Password</label>
                <a href="#" className="auth__forgot">Forgot?</a>
              </div>
              <input
                id="password"
                type="password"
                required
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
                  <Loader2 className="animate-spin" size={16} /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="auth__alt">
            Don&rsquo;t have an account?{' '}
            <Link to="/signup" className="auth__link">
              Create one <ChevronRight size={12} />
            </Link>
          </p>

          <p className="auth__hint">
            Demo credentials are pre-filled for the SciBlitz review.
          </p>
        </div>
      </main>
    </div>
  );
}