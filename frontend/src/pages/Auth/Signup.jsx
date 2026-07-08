import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Loader2, ArrowRight, ChevronRight, Camera, Phone } from 'lucide-react';
import {
  formatBdPhone,
  buildRecaptcha,
  sendOtp,
  confirmOtp,
} from '../../features/auth/firebasePhoneAuth';
import {
  uploadProfilePhoto,
  readFileAsDataUrl,
} from '../../features/auth/uploadProfilePhoto';
import './auth.css';

/**
 * Signup — three steps:
 *   1. Basic info (name, email, phone, password, home_area)
 *   2. Phone OTP (Firebase invisible reCAPTCHA + 6-digit code)
 *   3. Profile photo + final submit (uploads to Firebase Storage)
 *
 * We phone-verify BEFORE creating the backend account so the backend
 * can store `phone_verified = true` directly. (Simpler than creating
 * the account, then updating it.)
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
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const recaptchaRef = useRef(null);
  const fileInputRef = useRef(null);

  const { signup, setSupabaseJwt } = useAuth();
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
    if (!formatBdPhone(formData.phone)) {
      setError('Enter a valid Bangladesh phone number (e.g. 01712345678).');
      return;
    }
    setStep(2);
  };

  /* ----- Step 2: send / confirm phone OTP ----- */
  const handleSendOtp = async () => {
    setError('');
    setIsLoading(true);
    try {
      const phoneE164 = formatBdPhone(formData.phone);
      if (!recaptchaRef.current) {
        recaptchaRef.current = buildRecaptcha('recaptcha-container');
      }
      const result = await sendOtp(recaptchaRef.current, phoneE164);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err) {
      console.error(err);
      // Translate the most common Firebase error codes into actionable
      // guidance for the user. The raw "auth/configuration-not-found"
      // is opaque; this version points at the fix.
      const code = err?.code || '';
      if (code === 'auth/configuration-not-found') {
        setError(
          'Phone sign-in is not enabled in the Firebase project. ' +
          'Open Firebase Console → Authentication → Sign-in method → Phone → Enable. ' +
          'See FIREBASE_SETUP.md for the full step-by-step.'
        );
      } else if (code === 'auth/invalid-phone-number') {
        setError('That phone number was rejected by Firebase. Double-check the format (+880XXXXXXXXXX).');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many OTP requests. Wait a few minutes and try again.');
      } else if (code === 'auth/quota-exceeded') {
        setError('SMS quota exhausted for this Firebase project. Contact the project owner.');
      } else {
        setError(err?.message || 'Failed to send OTP. Check your phone number and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code we just sent.');
      return;
    }
    setIsLoading(true);
    try {
      const { user, idToken } = await confirmOtp(confirmationResult, otp);
      // Persist the Firebase ID token so api.js attaches it as Bearer
      // (backend can optionally verify Supabase/Firebase tokens).
      if (idToken) setSupabaseJwt(idToken);
      // We treat phone_verified=true once Firebase confirms.
      formData._firebaseUid = user.uid;
      setStep(3);
    } catch (err) {
      console.error(err);
      setError('Wrong code, or the code expired. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ----- Step 3: photo + final submit ----- */
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
        const uid = formData._firebaseUid || `local-${Date.now()}`;
        photoUrl = await uploadProfilePhoto(photoFile, uid);
      }

      // 2) Call backend /auth/signup with everything
      await signup({
        name: formData.name,
        email: formData.email,
        phone: formatBdPhone(formData.phone),
        password: formData.password,
        home_area: formData.home_area,
        photo_url: photoUrl,
        phone_verified: true, // Firebase already verified
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
          <div className="eyebrow">Get started</div>
          <h2 className="auth__panel-title">
            Build your <em>trusted circle</em><br />before you need it.
          </h2>
          <p className="auth__panel-text">
            Add the people who should know when you&rsquo;re unsafe — family, friends, a coworker who walks
            the same road home. Three contacts is enough. Twenty is better.
          </p>

          <ul className="auth__panel-list">
            <li><span className="auth__panel-dot" /> Phone-verified identity (no NID needed)</li>
            <li><span className="auth__panel-dot" /> No app to install for your circle</li>
            <li><span className="auth__panel-dot" /> Anonymous incident reports stay anonymous</li>
          </ul>
        </div>

        <div className="auth__panel-foot">
          <span className="auth__panel-foot-meta">v0.2 · CUET SciBlitz</span>
          <span className="auth__panel-foot-meta">© {new Date().getFullYear()}</span>
        </div>
      </aside>

      {/* Right: form */}
      <main className="auth__main">
        <div className="auth__form-wrap">
          <Link to="/" className="auth__home-link">← Back to home</Link>

          <header className="auth__form-head">
            <h1 className="auth__title">Create account</h1>
            <p className="auth__sub">
              {step === 1 && 'Step 1 of 3 — your details'}
              {step === 2 && 'Step 2 of 3 — verify your phone'}
              {step === 3 && 'Step 3 of 3 — add a photo'}
            </p>
          </header>

          {error && (<div className="auth__error" role="alert">{error}</div>)}

          {/* Step 1: basic info */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="auth__form">
              <div className="auth__field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name" type="text" required className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoComplete="name"
                />
              </div>

              <div className="auth__field">
                <label htmlFor="email">
                  Email <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="email" type="email" required className="input-field"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
                <small className="auth__hint" style={{ display: 'block', marginTop: 4, color: '#888' }}>
                  Required — your emergency contacts receive SOS alerts by email, and we send
                  you an account-recovery link if you ever get locked out.
                </small>
              </div>

              <div className="auth__field">
                <label htmlFor="phone">Phone number (Bangladesh)</label>
                <input
                  id="phone" type="tel" required className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  autoComplete="tel"
                  placeholder="01712 345 678"
                />
              </div>

              <div className="auth__field">
                <label htmlFor="home_area">Home area / neighborhood</label>
                <input
                  id="home_area" type="text" className="input-field"
                  value={formData.home_area}
                  onChange={(e) => setFormData({ ...formData, home_area: e.target.value })}
                  autoComplete="address-level2"
                  placeholder="e.g. Halishahar, Agrabad"
                />
                <small className="auth__hint" style={{ display: 'block', marginTop: 4, color: '#888' }}>
                  Used to center your map and personalize the chatbot — never verified, never shared.
                </small>
              </div>

              <div className="auth__field">
                <label htmlFor="password">Password</label>
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
                Continue <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* Step 2: phone OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="auth__form">
              <div id="recaptcha-container" />

              <p className="auth__sub" style={{ marginBottom: 12 }}>
                We&rsquo;ll send a one-time code to{' '}
                <strong>{formatBdPhone(formData.phone) || formData.phone}</strong> via SMS
                to confirm it&rsquo;s really you.
              </p>

              {!otpSent ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  style={{ minHeight: 44 }}
                >
                  {isLoading ? (
                    <><Loader2 className="animate-spin" size={16} /> Sending code…</>
                  ) : (
                    <><Phone size={16} /> Send verification code</>
                  )}
                </button>
              ) : (
                <>
                  <div className="auth__field">
                    <label htmlFor="otp">6-digit code</label>
                    <input
                      id="otp" type="text" inputMode="numeric" maxLength={6}
                      required className="input-field"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      autoComplete="one-time-code"
                      placeholder="123456"
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading || otp.length !== 6}
                    style={{ minHeight: 44, marginTop: 'var(--space-2)' }}
                  >
                    {isLoading ? (
                      <><Loader2 className="animate-spin" size={16} /> Verifying…</>
                    ) : (
                      <>Verify code <ArrowRight size={16} /></>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleSendOtp}
                    style={{ marginTop: 8, color: 'var(--color-text-muted)' }}
                  >
                    Resend code
                  </button>
                </>
              )}

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep(1)}
                style={{ marginTop: 16, color: 'var(--color-text-muted)' }}
              >
                ← Back to step 1
              </button>
            </form>
          )}

          {/* Step 3: photo upload + final submit */}
          {step === 3 && (
            <form onSubmit={handleFinalSubmit} className="auth__form">
              <div className="auth__field" style={{ textAlign: 'center' }}>
                <label
                  htmlFor="photo"
                  style={{
                    display: 'inline-block',
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: photoPreview
                      ? `url(${photoPreview}) center/cover no-repeat #f4f4f5`
                      : '#f4f4f5',
                    border: '2px dashed #ccc',
                    cursor: 'pointer',
                    lineHeight: '120px',
                  }}
                  aria-label="Upload profile photo"
                >
                  {!photoPreview && <Camera size={28} style={{ verticalAlign: 'middle', color: '#888' }} />}
                </label>
                <input
                  id="photo" type="file" accept="image/*"
                  ref={fileInputRef} onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
                <p style={{ marginTop: 8, color: '#888', fontSize: 13 }}>
                  Optional — your photo helps trusted contacts confirm it&rsquo;s really you during SOS.
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ minHeight: 44, marginTop: 'var(--space-2)' }}
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin" size={16} /> Creating account…</>
                ) : (
                  <>Create account <ArrowRight size={16} /></>
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep(2)}
                style={{ marginTop: 8, color: 'var(--color-text-muted)' }}
              >
                ← Back
              </button>
            </form>
          )}

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