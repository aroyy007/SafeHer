import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { ShieldCheck, Loader2, ArrowRight, ChevronRight, Camera } from 'lucide-react';
import {
  uploadProfilePhoto,
  readFileAsDataUrl,
} from '../../features/auth/uploadProfilePhoto';
import './auth.css';

/**
 * Signup — two steps:
 *   1. Basic info (name, email, phone, home_area, password)
 *   2. Profile photo + final submit (uploads to Firebase Storage)
 *
 * No phone OTP. Phone is collected as a plain text field (used by the
 * backend to identify the user and by the SOS flow to format alerts)
 * but is not verified at signup time. A phone-verified identity check
 * can be added later behind a feature flag if needed for the demo.
 */
export function Signup() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    home_area: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const { signup } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  /* ----- Step 1: validate basic info ----- */
  const handleStep1 = (e) => {
    e.preventDefault();
    setError('');

    const disposableHint = _checkDisposableClient(formData.email);
    if (disposableHint) {
      setError(disposableHint);
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!formData.name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please enter your email.');
      return;
    }
    setStep(2);
  };

  /* ----- Step 2: photo + final submit ----- */
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Profile photo must be an image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be under 5 MB.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(await readFileAsDataUrl(file));
    setError('');
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // 1) Upload photo (if any) → returns public URL
      let photoUrl = '';
      if (photoFile) {
        // No Firebase UID since we removed phone OTP — derive a stable
        // local id so the photo can be replaced/re-uploaded later.
        const localUid = `local-${Date.now()}`;
        photoUrl = await uploadProfilePhoto(photoFile, localUid);
      }

      // 2) Call backend /auth/signup with everything. Phone is collected
      //    as a plain string and stored unverified.
      await signup({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        home_area: formData.home_area,
        photo_url: photoUrl,
        phone_verified: false,
      });
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
      'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
      'yopmail.com', 'throwawaymail.com', 'maildrop.cc', 'trashmail.com',
      'fakeinbox.com', 'getnada.com', 'sharklasers.com', 'dispostable.com',
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
          <div className="eyebrow">{t('Get started')}</div>
          <h2 className="auth__panel-title">
            {t('Build your')} <em>{t('trusted circle')}</em><br />{t('before you need it.')}
          </h2>
          <p className="auth__panel-text">
            {t('Add the people you want to reach if you activate SOS. Set up their contact details before you need them.')}
          </p>

          <ul className="auth__panel-list">
            <li><span className="auth__panel-dot" /> {t('Email is required for your account')}</li>
            <li><span className="auth__panel-dot" /> {t('Add contact email addresses for alert links')}</li>
            <li><span className="auth__panel-dot" /> {t('Active location links expire after 24 hours')}</li>
          </ul>
        </div>

        <div className="auth__panel-foot">
          <span className="auth__panel-foot-meta">v0.3 · CUET SciBlitz</span>
          <span className="auth__panel-foot-meta">© {new Date().getFullYear()}</span>
        </div>
      </aside>

      {/* Right: form */}
      <main className="auth__main">
        <div className="auth__form-wrap">
          <div className="auth__utility-row">
            <Link to="/" className="auth__home-link">{t('← Back to home')}</Link>
            <LanguageSwitcher />
          </div>

          <header className="auth__form-head">
            <h1 className="auth__title">{t('Create account')}</h1>
            <p className="auth__sub">
              {step === 1 && t('Step 1 of 2 — your details')}
              {step === 2 && t('Step 2 of 2 — add a photo')}
            </p>
          </header>

          {error && (<div className="auth__error" role="alert">{t(error)}</div>)}

          {/* Step 1: basic info */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="auth__form">
              <div className="auth__field">
                <label htmlFor="name">{t('Full name')}</label>
                <input
                  id="name" type="text" required className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoComplete="name"
                />
              </div>

              <div className="auth__field">
                <label htmlFor="email">
                  {t('Email')} <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="email" type="email" required className="input-field"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  autoComplete="email"
                  placeholder={t('you@example.com')}
                />
                <small className="auth__hint">
                  {t('Required — your emergency contacts receive SOS alerts by email. We do not verify your email during signup.')}
                </small>
              </div>

              <div className="auth__field">
                <label htmlFor="phone">{t('Phone (optional)')}</label>
                <input
                  id="phone" type="tel" className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  autoComplete="tel"
                  placeholder={t('01712 345 678')}
                />
                <small className="auth__hint">
                  {t('Optional — used to personalize SOS alerts. Not verified at signup.')}
                </small>
              </div>

              <div className="auth__field">
                <label htmlFor="home_area">{t('Home area / neighborhood')}</label>
                <input
                  id="home_area" type="text" className="input-field"
                  value={formData.home_area}
                  onChange={(e) => setFormData({ ...formData, home_area: e.target.value })}
                  autoComplete="address-level2"
                  placeholder={t('e.g. Halishahar, Agrabad')}
                />
                <small className="auth__hint">
                  {t('Used to center your map and personalize the chatbot — never verified, never shared.')}
                </small>
              </div>

              <div className="auth__field">
                <label htmlFor="password">{t('Password')}</label>
                <input
                  id="password" type="password" required minLength={8} className="input-field"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ minHeight: 44, marginTop: 'var(--space-2)' }}
              >
                {t('Continue')} <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* Step 2: photo upload + final submit */}
          {step === 2 && (
            <form onSubmit={handleFinalSubmit} className="auth__form">
              <div className="auth__field" style={{ textAlign: 'center' }}>
                <label
                  htmlFor="photo"
                  className={`auth__photo-picker ${photoPreview ? 'has-photo' : ''}`}
                  style={photoPreview ? { backgroundImage: `url(${photoPreview})` } : undefined}
                  aria-label={t('Upload profile photo')}
                  aria-describedby="photo-help"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  {!photoPreview && <Camera size={28} aria-hidden="true" />}
                </label>
                <input
                  id="photo" type="file" accept="image/*"
                  ref={fileInputRef} onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
                <p id="photo-help" className="auth__photo-help">
                  {t('Optional — your photo helps trusted contacts confirm it’s really you during SOS.')}
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ minHeight: 44, marginTop: 'var(--space-2)' }}
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin" size={16} /> {t('Creating account…')}</>
                ) : (
                  <>{t('Create account')} <ArrowRight size={16} /></>
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep(1)}
                style={{ marginTop: 8, color: 'var(--color-text-muted)' }}
              >
                {t('← Back')}
              </button>
            </form>
          )}

          <p className="auth__alt">
            {t('Already have an account?')}{' '}
            <Link to="/login" className="auth__link">
              {t('Sign in')} <ChevronRight size={12} />
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
