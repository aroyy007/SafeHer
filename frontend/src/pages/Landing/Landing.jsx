import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock3,
  Map,
  Menu,
  MessageCircle,
  PhoneCall,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import './landing.css';

const capabilities = [
  {
    icon: <ShieldAlert size={20} strokeWidth={1.8} />,
    title: 'A deliberate SOS action',
    description: 'Hold the SOS control for three seconds to reduce accidental activation. Call 999 directly whenever you need urgent help.',
    tone: 'moss',
  },
  {
    icon: <Users size={20} strokeWidth={1.8} />,
    title: 'People you choose',
    description: 'Set up your emergency contacts and trusted circles ahead of time. Add an email address when you want them to receive the tracking link.',
    tone: 'sage',
  },
  {
    icon: <Map size={20} strokeWidth={1.8} />,
    title: 'Route options with context',
    description: 'Compare a distance-only route with a heuristic estimate where the current Chattogram road graph has coverage.',
    tone: 'slate',
  },
  {
    icon: <MessageCircle size={20} strokeWidth={1.8} />,
    title: 'Safety information in chat',
    description: 'Ask general questions in Bengali or English. Treat the assistant as a starting point, not an emergency service or a substitute for an official source.',
    tone: 'sage',
  },
  {
    icon: <Clock3 size={20} strokeWidth={1.8} />,
    title: 'A time-limited location link',
    description: 'An active tracking link can be opened in a browser and expires after 24 hours. Anyone who has the link can view it while it is active.',
    tone: 'slate',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="landing">
      <a className="landing-skip" href="#main">{t('Skip to content')}</a>
      <Nav onOpenApp={() => navigate('/app/sos')} />

      <main id="main">
        <Hero
          onOpenApp={() => navigate('/app/sos')}
          onCreateAccount={() => navigate('/signup')}
        />

        <section className="landing-intro" id="how" aria-labelledby="how-title">
          <div className="landing-intro__lead">
            <span className="landing-kicker">{t('Made for real life in Bangladesh')}</span>
            <h2 id="how-title">{t('A little more room to decide what comes next.')}</h2>
          </div>
          <p className="landing-intro__body">
            {t('Set up your circle while things are calm. If you need help, SafeHer keeps the next steps close and makes the limits of each tool clear.')}
          </p>
        </section>

        <section className="landing-capabilities" id="features" aria-labelledby="capabilities-title">
          <div className="landing-section-head">
            <div>
              <span className="landing-kicker">{t('Safety tools')}</span>
              <h2 id="capabilities-title">{t('Support for the next step.')}</h2>
            </div>
            <p>{t('Choose what helps. Nothing here replaces local emergency services.')}</p>
          </div>

          <div className="landing-capability-grid">
            {capabilities.map((item) => (
              <article className={`landing-capability landing-capability--${item.tone}`} key={item.title}>
                <span className="landing-capability__icon" aria-hidden="true">{item.icon}</span>
                <h3>{t(item.title)}</h3>
                <p>{t(item.description)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-flow" aria-labelledby="flow-title">
          <div className="landing-flow__intro">
            <span className="landing-kicker">{t('Before and during an alert')}</span>
            <h2 id="flow-title">{t('Make a plan while it is quiet.')}</h2>
            <p>{t('SafeHer works best when your account and trusted contacts are ready before you need them.')}</p>
            <Button variant="secondary" onClick={() => navigate('/signup')} rightIcon={<ArrowRight size={16} />}>
              {t('Set up your account')}
            </Button>
          </div>

          <ol className="landing-flow__steps">
            <li>
              <span className="landing-flow__number">01</span>
              <div>
                <h3>{t('Add your people')}</h3>
                <p>{t('Sign in and add the contacts or circles you want to reach. Email is needed to deliver the tracking link.')}</p>
              </div>
            </li>
            <li>
              <span className="landing-flow__number">02</span>
              <div>
                <h3>{t('Hold SOS for three seconds')}</h3>
                <p>{t('When you activate SOS, SafeHer attempts to alert your configured contacts and share your location when access is available.')}</p>
              </div>
            </li>
            <li>
              <span className="landing-flow__number">03</span>
              <div>
                <h3>{t('Use the help that fits')}</h3>
                <p>{t('Open the tracking link, review route options where available, or call 999 directly. SafeHer does not dispatch responders.')}</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="landing-data" id="data" aria-labelledby="data-title">
          <div className="landing-data__heading">
            <span className="landing-kicker">{t('Map and route context')}</span>
            <h2 id="data-title">{t('An estimate is one piece of information.')}</h2>
          </div>
          <div className="landing-data__body">
            <p>
              {t('Route comparisons use a heuristic and the current Chattogram road graph. The map can show approximate counts from CrimeDataBD v4, a news-derived dataset with approximate coordinates.')}
            </p>
            <ul>
              <li>{t('The dataset has no year or victim-gender field.')}</li>
              <li>{t('Record density is not a street-level safety score.')}</li>
              <li>{t('Coverage and source data can be incomplete or out of date.')}</li>
            </ul>
            <p className="landing-data__attribution">CrimeDataBD v4 · CC BY-NC 4.0</p>
          </div>
        </section>

        <section className="landing-last-call" aria-labelledby="last-call-title">
          <div>
            <span className="landing-kicker">{t('SafeHer is ready when you are')}</span>
            <h2 id="last-call-title">{t('Set up your trusted circle.')}</h2>
            <p>{t('Sign in to open the safety tools, add contacts, and review the available map coverage.')}</p>
          </div>
          <div className="landing-last-call__actions">
            <Button variant="primary" onClick={() => navigate('/app/sos')} rightIcon={<ArrowRight size={16} />}>
              {t('Open SafeHer')}
            </Button>
            <Link to="/login" className="landing-text-link">{t('Sign in')}</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Nav({ onOpenApp }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="landing-nav-wrap">
      <nav className="landing-nav" aria-label={t('Primary navigation')}>
        <Link to="/" className="landing-nav__brand" aria-label={t('SafeHer home')} onClick={closeMenu}>
          <span className="landing-nav__brand-mark" aria-hidden="true"><ShieldAlert size={17} strokeWidth={2} /></span>
          <span>SafeHer</span>
        </Link>

        <LanguageSwitcher />

        <button
          type="button"
          className="landing-nav__menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="landing-navigation-links"
          aria-label={t(menuOpen ? 'Close navigation menu' : 'Open navigation menu')}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div id="landing-navigation-links" className={`landing-nav__links ${menuOpen ? 'is-open' : ''}`}>
          <a className="landing-nav__link" href="#features" onClick={closeMenu}>{t('Safety tools')}</a>
          <a className="landing-nav__link" href="#how" onClick={closeMenu}>{t('How it works')}</a>
          <a className="landing-nav__link" href="#data" onClick={closeMenu}>{t('Map data')}</a>
          <Button variant="primary" size="sm" onClick={() => { closeMenu(); onOpenApp(); }}>
            {t('Open SafeHer')} <ArrowRight size={15} />
          </Button>
        </div>
      </nav>
    </header>
  );
}

function Hero({ onOpenApp, onCreateAccount }) {
  const { t } = useLanguage();
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero__copy">
        <div className="landing-hero__location"><span aria-hidden="true" /> {t('Bengali-first safety companion · Bangladesh')}</div>
        <h1 id="landing-title">{t('Help, kept close.')}</h1>
        <p className="landing-hero__sub">
          {t('Your trusted contacts, a deliberate SOS action, live location sharing, and route estimates where map coverage exists — together in one web app.')}
        </p>
        <div className="landing-hero__actions">
          <Button variant="primary" size="lg" onClick={onOpenApp} rightIcon={<ArrowRight size={17} />}>
            {t('Open SafeHer')}
          </Button>
          <button type="button" className="landing-hero__secondary" onClick={onCreateAccount}>{t('Create an account')}</button>
        </div>
        <p className="landing-hero__account-note">{t('Sign in to use personal safety tools and set up your contacts.')}</p>
        <a className="landing-hero__emergency" href="tel:999">
          <PhoneCall size={16} aria-hidden="true" />
          <span><strong>{t('Need urgent help?')}</strong> {t('Call 999')}</span>
        </a>
      </div>

      <div className="landing-hero__visual">
        <div className="landing-route-mark landing-route-mark--one" aria-hidden="true" />
        <div className="landing-route-mark landing-route-mark--two" aria-hidden="true" />
        <div className="landing-preview" role="img" aria-label={t('Illustrative SafeHer screen preview. No alert is active. Hold SOS for three seconds to alert configured trusted contacts.')}>
          <div className="landing-preview__top">
            <div className="landing-preview__brand"><span aria-hidden="true">S</span> SafeHer</div>
            <span className="landing-preview__label">{t('Illustrative preview')}</span>
          </div>
          <div className="landing-preview__status"><span aria-hidden="true" /> {t('No alert active')} <span className="landing-preview__status-divider" /> {t('Location not shared')}</div>
          <div className="landing-preview__action-wrap">
            <div className="landing-preview__action">
              <span>{t('PRESS & HOLD')}</span>
              <strong>SOS</strong>
            </div>
          </div>
          <p className="landing-preview__instruction">{t('Hold for 3 seconds to alert your configured contacts')}</p>
          <div className="landing-preview__divider" />
          <div className="landing-preview__note">
            <span className="landing-preview__note-icon"><Users size={17} /></span>
            <span><strong>{t('Your people, your choice')}</strong><small>{t('Prepare your trusted circle before you need it.')}</small></span>
          </div>
          <div className="landing-preview__note">
            <span className="landing-preview__note-icon landing-preview__note-icon--slate"><Clock3 size={17} /></span>
            <span><strong>{t('Location link ends after 24 hours')}</strong><small>{t('Share a live link during an active SOS.')}</small></span>
          </div>
        </div>
        <p className="landing-hero__caption">{t('A clear next step, with the current status in view.')}</p>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="landing-footer">
      <Link to="/" className="landing-footer__brand"><span aria-hidden="true">S</span> SafeHer</Link>
      <p>{t('SafeHer is not an emergency dispatch service. For immediate help in Bangladesh, call')} <a href="tel:999">999</a>.</p>
      <div className="landing-footer__links">
        <Link to="/login">{t('Sign in')}</Link>
        <Link to="/signup">{t('Create account')}</Link>
        <a href="#data">{t('Map data notes')}</a>
      </div>
    </footer>
  );
}
