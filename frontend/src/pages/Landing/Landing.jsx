import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, MapPin, MessageCircle, Calculator, Mic, Map as MapIcon, ChevronRight, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import './landing.css';

export function Landing() {
  const navigate = useNavigate();
  const rootRef = useRef(null);

  // IntersectionObserver-based reveal-on-scroll
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = root.querySelectorAll('.reveal');
    if (!items.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    items.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="landing" ref={rootRef}>
      <Nav />
      <Hero onPrimary={() => navigate('/app/sos')} onSecondary={() => scrollTo('features')} />
      <Features />
      <Stats />
      <HowItWorks />
      <Cta onPrimary={() => navigate('/app/sos')} onSecondary={() => navigate('/track/demo_user_1')} />
      <Footer />
    </div>
  );

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function Nav() {
  return (
    <nav className="landing-nav" aria-label="Primary">
      <a href="/" className="landing-nav__brand" aria-label="SafeHer home">
        <span className="landing-nav__brand-mark" aria-hidden="true">
          <ShieldAlert size={16} strokeWidth={2.25} />
        </span>
        SafeHer
      </a>
      <div className="landing-nav__links">
        <a className="landing-nav__link" href="#features">Features</a>
        <a className="landing-nav__link" href="#how">How it works</a>
        <a className="landing-nav__link" href="#stats">Context</a>
        <Button
          variant="primary"
          size="sm"
          onClick={() => (window.location.href = '/app/sos')}
          rightIcon={<ChevronRight size={14} />}
        >
          Open app
        </Button>
      </div>
    </nav>
  );
}

function Hero({ onPrimary, onSecondary }) {
  return (
    <section className="landing-hero">
      <div className="reveal">
        <div className="landing-hero__eyebrow">
          <Lock size={12} strokeWidth={2} /> Built for women in Bangladesh
        </div>
        <h1 className="landing-hero__title">
          A safety net,<br />
          <span className="landing-hero__title-accent">always within reach.</span>
        </h1>
        <p className="landing-hero__sub">
          <span className="font-bn">"বাঁচাও"</span> — the first Bengali-voice-activated safety app.
          One tap alerts your trusted circle, shares your live location, and routes you home
          on the safest path. No app to install. No account to create.
        </p>
        <div className="landing-hero__ctas">
          <Button
            variant="primary"
            size="lg"
            onClick={onPrimary}
            rightIcon={<ChevronRight size={18} />}
            leftIcon={<ShieldAlert size={18} strokeWidth={2} />}
          >
            Try the SOS demo
          </Button>
          <Button variant="ghost" size="lg" onClick={onSecondary}>
            How it works
          </Button>
        </div>
        <div className="landing-hero__meta">
          <div className="landing-hero__meta-item">
            <strong>3s</strong>
            <span>To alert trusted circle</span>
          </div>
          <div className="landing-hero__meta-item">
            <strong>0</strong>
            <span>Apps to install</span>
          </div>
          <div className="landing-hero__meta-item">
            <strong>24/7</strong>
            <span>Voice trigger on</span>
          </div>
        </div>
      </div>

      <div className="landing-hero__preview reveal">
        <div className="phone-frame" role="img" aria-label="SafeHer SOS button preview">
          <div className="phone-frame__screen">
            <div className="phone-frame__label">Press &amp; hold</div>
            <div className="phone-frame__sos">SOS</div>
            <div className="phone-frame__caption">
              Hold for 3 seconds to alert<br />your trusted contacts
            </div>
          </div>
          <div className="phone-frame__chip phone-frame__chip--voice">
            <span className="phone-frame__chip-dot phone-frame__chip-dot--brand" />
            <Mic size={12} /> বাঁচাও ready
          </div>
          <div className="phone-frame__chip phone-frame__chip--safe">
            <span className="phone-frame__chip-dot" />
            Live location on
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="landing-section" id="features">
      <div className="landing-section__head reveal">
        <div className="landing-section__eyebrow">Features</div>
        <h2 className="landing-section__title">Five features no other safety app has.</h2>
        <p className="landing-section__sub">
          Built specifically for Bangladesh. Bengali-first. No app install. No phone number required.
        </p>
      </div>

      <div className="landing-features">
        <FeatureCard
          icon={<Mic size={22} strokeWidth={1.75} />}
          iconClass="feature-card__icon--info"
          title="Bengali voice SOS"
          desc='Say "বাঁচাও" and emergency mode activates. No tapping. No looking at the screen.'
          tags={['bn-BD', 'No ML cost', 'Always on']}
        />
        <FeatureCard
          icon={<MapIcon size={22} strokeWidth={1.75} />}
          iconClass="feature-card__icon--safe"
          title="Crime-aware safe routes"
          desc="Routes scored on 6,574 real Bangladesh crime records. See safe vs fast side-by-side."
          tags={['KDE + A*', 'OSM', 'Live data']}
        />
        <FeatureCard
          icon={<MessageCircle size={22} strokeWidth={1.75} />}
          iconClass="feature-card__icon--purple"
          title="Bengali RAG assistant"
          desc="Ask anything about women's rights, emergency numbers, or local safety — answers grounded in verified Bangladesh sources only."
          tags={['Bengali SBERT', 'ChromaDB', 'No hallucination']}
        />
        <FeatureCard
          icon={<Calculator size={22} strokeWidth={1.75} />}
          iconClass="feature-card__icon--gray"
          title="Calculator disguise"
          desc="The app looks like a calculator to anyone watching. SOS still armed underneath."
          tags={['No sound', 'Secret code', 'Silent 999']}
        />
        <FeatureCard
          icon={<MapPin size={22} strokeWidth={1.75} />}
          iconClass="feature-card__icon--warn"
          title="Live location sharing"
          desc="Family opens a link in any browser. No app to install on their end."
          tags={['Firebase RTDB', '5s updates', 'Public link']}
        />
        <FeatureCard
          icon={<ShieldAlert size={22} strokeWidth={1.75} />}
          title="3-second hold SOS"
          desc="Big red button. 3-second hold to prevent fat-finger. Vibrates. Alerts everyone."
          tags={['No confirmation', 'Haptic', 'Vibration API']}
        />
      </div>
    </section>
  );
}

function FeatureCard({ icon, iconClass = '', title, desc, tags = [] }) {
  return (
    <div className="feature-card reveal">
      <div className={`feature-card__icon ${iconClass}`}>{icon}</div>
      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__desc">{desc}</p>
      {tags.length > 0 && (
        <div className="feature-card__list">
          {tags.map((t) => (
            <span key={t} className="feature-card__chip">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stats() {
  return (
    <section className="landing-stats" id="stats">
      <div className="landing-stats__inner">
        <div className="reveal">
          <div className="landing-stat__num">7,028</div>
          <div className="landing-stat__label">
            violence cases reported in the first four months of 2025
          </div>
          <span className="landing-stat__source">Bangladesh media monitoring, 2025</span>
        </div>
        <div className="reveal">
          <div className="landing-stat__num">6,574</div>
          <div className="landing-stat__label">
            real crime records training our safe-route algorithm
          </div>
          <span className="landing-stat__source">CrimeDataBD, Mendeley 2025</span>
        </div>
        <div className="reveal">
          <div className="landing-stat__num">90%</div>
          <div className="landing-stat__label">
            of women in Dhaka report harassment on public transport
          </div>
          <span className="landing-stat__source">BRAC study, 2023</span>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="landing-section" id="how">
      <div className="landing-section__head reveal">
        <div className="landing-section__eyebrow">How it works</div>
        <h2 className="landing-section__title">From unsafe to safe in three steps.</h2>
        <p className="landing-section__sub">
          Designed for the moment your hands are shaking and you need help in seconds.
        </p>
      </div>
      <div className="landing-steps">
        <div className="step-card reveal">
          <div className="step-card__num">1</div>
          <h3 className="step-card__title">Trigger</h3>
          <p className="step-card__desc">
            Hold the red button for 3 seconds, say <span className="font-bn">"বাঁচাও"</span>,
            or triple-tap from the calculator disguise. All three work without unlocking
            the screen.
          </p>
        </div>
        <div className="step-card reveal">
          <div className="step-card__num">2</div>
          <h3 className="step-card__title">Alert</h3>
          <p className="step-card__desc">
            Your trusted circle gets an email with your live location. They open a link in
            any browser — no app to install. The link streams your position every 5 seconds.
          </p>
        </div>
        <div className="step-card reveal">
          <div className="step-card__num">3</div>
          <h3 className="step-card__title">Get to safety</h3>
          <p className="step-card__desc">
            The app shows two routes home — one fast, one safe. The safe one is scored on
            6,574 real crime records and avoids dark, unlit, and incident-dense streets.
          </p>
        </div>
      </div>
    </section>
  );
}

function Cta({ onPrimary, onSecondary }) {
  return (
    <section className="landing-cta reveal">
      <div className="landing-cta__inner">
        <h2 className="landing-cta__title">No install. No signup. Open and go.</h2>
        <p className="landing-cta__sub">
          SafeHer is a website that opens in 2 seconds. Bookmark it on your home screen,
          and the SOS button is always one tap away.
        </p>
        <div className="landing-cta__btns">
          <Button
            variant="primary"
            size="lg"
            onClick={onPrimary}
            rightIcon={<ChevronRight size={18} />}
          >
            Open SafeHer
          </Button>
          <Button variant="outline" size="lg" onClick={onSecondary}>
            See a live tracking link
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__inner">
        <div className="landing-footer__text">
          © {new Date().getFullYear()} SafeHer. Built at CUET for the SciBlitz hackathon.
        </div>
        <div className="landing-footer__links">
          <a className="landing-footer__link" href="#features">Features</a>
          <a className="landing-footer__link" href="#how">How it works</a>
          <a className="landing-footer__link" href="https://github.com" target="_blank" rel="noreferrer">Source</a>
          <a className="landing-footer__link" href="mailto:hello@safeher.app">Contact</a>
        </div>
      </div>
    </footer>
  );
}
