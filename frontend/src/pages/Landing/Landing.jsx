import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, MapPin, MessageCircle, Calculator, Mic, Map as MapIcon, ChevronRight, ArrowUpRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import './landing.css';

export function Landing() {
  const navigate = useNavigate();
  const rootRef = useRef(null);

  // IntersectionObserver-based reveal-on-scroll
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = root.querySelectorAll('.reveal, .reveal-stagger');
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
      <Nav onOpenApp={() => navigate('/app/sos')} />
      <Hero
        onPrimary={() => navigate('/app/sos')}
        onSecondary={() => scrollTo('features')}
      />
      <TrustedBy />
      <Features />
      <Stats />
      <HowItWorks />
      <DarkSection />
      <Cta
        onPrimary={() => navigate('/app/sos')}
        onSecondary={() => navigate('/track/demo_user_1')}
      />
      <Footer />
    </div>
  );

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* --------------------------- NAV (sticky blur on scroll) --------------------------- */

function Nav({ onOpenApp }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`} aria-label="Primary">
      <a href="/" className="landing-nav__brand" aria-label="SafeHer home">
        <span className="landing-nav__brand-mark" aria-hidden="true">
          <ShieldAlert size={13} strokeWidth={2.5} />
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
          onClick={onOpenApp}
          rightIcon={<ChevronRight size={14} />}
        >
          Open app
        </Button>
      </div>
    </nav>
  );
}

/* --------------------------- HERO --------------------------- */

function Hero({ onPrimary, onSecondary }) {
  return (
    <section className="landing-hero">
      <div className="landing-hero__copy reveal">
        <a className="landing-hero__pill" href="#features">
          <span className="landing-hero__pill-icon"><ArrowUpRight size={10} strokeWidth={2.5} /></span>
          Built for women in Bangladesh
        </a>

        <h1 className="landing-hero__title">
          A safety net,<br />
          <em>always within reach.</em>
        </h1>

        <p className="landing-hero__sub">
          <span className="font-bn">&ldquo;বাঁচাও&rdquo;</span> &mdash; the first Bengali-voice-activated safety app.
          One tap alerts your trusted circle, shares your live location, and routes you home on the safest path.
          No app to install. No account to create.
        </p>

        <div className="landing-hero__ctas">
          <Button
            variant="primary"
            size="lg"
            onClick={onPrimary}
            rightIcon={<ChevronRight size={16} />}
            leftIcon={<ShieldAlert size={16} strokeWidth={2} />}
          >
            Try the SOS demo
          </Button>
          <Button variant="secondary" size="lg" onClick={onSecondary}>
            How it works
          </Button>
        </div>

        <div className="landing-hero__meta">
          <div className="landing-hero__meta-item">
            <strong>3s</strong>
            <span>To alert circle</span>
          </div>
          <div className="landing-hero__meta-item">
            <strong>0</strong>
            <span>Apps to install</span>
          </div>
          <div className="landing-hero__meta-item">
            <strong>24/7</strong>
            <span>Voice trigger</span>
          </div>
        </div>
      </div>

      <div className="landing-hero__visual reveal">
        <div className="landing-hero__illustration" role="img" aria-label="SafeHer SOS preview">
          <svg className="landing-hero__scribble" viewBox="0 0 460 480" fill="none" aria-hidden="true">
            <path d="M20 80 Q60 40 120 70 T 220 60" />
            <path d="M260 30 Q320 10 380 50 Q420 90 410 160 Q400 230 360 270" />
            <path d="M40 220 Q20 280 60 340 Q120 410 200 420" />
            <path d="M380 320 Q420 380 360 430 Q300 460 240 440" />
          </svg>

          <div className="landing-phone">
            <div className="landing-phone__screen">
              <div className="landing-phone__notch" />
              <div className="landing-phone__status">
                <span>9:41</span>
                <span>·  ·  ·</span>
              </div>
              <div className="landing-phone__label">Press &amp; hold</div>
              <div className="landing-phone__sos">SOS</div>
              <div className="landing-phone__caption">
                Hold for 3 seconds to alert<br />your trusted contacts
              </div>
            </div>
          </div>

          <div className="landing-floating landing-floating--voice">
            <span className="landing-floating__dot landing-floating__dot--accent" />
            <Mic size={11} /> বাঁচাও ready
          </div>
          <div className="landing-floating landing-floating--safe">
            <span className="landing-floating__dot" />
            Live location on
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- TRUSTED BY --------------------------- */

function TrustedBy() {
  const partners = [
    { name: 'CUET', tag: 'Research' },
    { name: 'SciBlitz', tag: 'Hackathon' },
    { name: 'BRAC', tag: 'Partner' },
    { name: 'CrimeDataBD', tag: 'Data' },
    { name: 'Firebase', tag: 'Infra' },
    { name: 'OpenStreetMap', tag: 'Maps' },
    { name: 'Groq', tag: 'AI' },
    { name: 'ChromaDB', tag: 'Search' },
  ];
  const loop = [...partners, ...partners];

  return (
    <div className="landing-marquee" aria-hidden="true">
      <div className="landing-marquee__label">Built with research-grade infrastructure</div>
      <div className="landing-marquee__track">
        {loop.map((p, i) => (
          <span key={i} className="landing-marquee__item">
            {p.name} <small>{p.tag}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- FEATURES --------------------------- */

function Features() {
  return (
    <section className="landing-section" id="features">
      <div className="landing-section__head reveal">
        <span className="eyebrow landing-section__eyebrow">Features</span>
        <h2 className="landing-section__title">Five features no other safety app has.</h2>
        <p className="landing-section__sub">
          Built specifically for Bangladesh. Bengali-first. No app install. No phone number required.
        </p>
      </div>

      <div className="landing-features reveal-stagger">
        <FeatureCard
          icon={<Mic size={20} strokeWidth={1.75} />}
          title="Bengali voice SOS"
          desc='Say "বাঁচাও" and emergency mode activates. No tapping. No looking at the screen.'
          tags={['bn-BD', 'No ML cost', 'Always on']}
        />
        <FeatureCard
          icon={<MapIcon size={20} strokeWidth={1.75} />}
          title="Crime-aware safe routes"
          desc="Routes scored on 6,574 real Bangladesh crime records. See safe vs fast side-by-side."
          tags={['KDE + A*', 'OSM', 'Live data']}
        />
        <FeatureCard
          icon={<MessageCircle size={20} strokeWidth={1.75} />}
          title="Bengali RAG assistant"
          desc="Ask anything about women's rights, emergency numbers, or local safety — answers grounded in verified Bangladesh sources only."
          tags={['Bengali SBERT', 'ChromaDB', 'No hallucination']}
        />
        <FeatureCard
          icon={<Calculator size={20} strokeWidth={1.75} />}
          title="Calculator disguise"
          desc="The app looks like a calculator to anyone watching. SOS still armed underneath."
          tags={['No sound', 'Secret code', 'Silent 999']}
        />
        <FeatureCard
          icon={<MapPin size={20} strokeWidth={1.75} />}
          title="Live location sharing"
          desc="Family opens a link in any browser. No app to install on their end."
          tags={['Firebase RTDB', '5s updates', 'Public link']}
        />
        <FeatureCard
          icon={<ShieldAlert size={20} strokeWidth={1.75} />}
          title="3-second hold SOS"
          desc="Big button. 3-second hold to prevent fat-finger. Vibrates. Alerts everyone."
          tags={['No confirmation', 'Haptic', 'Vibration API']}
        />
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, desc, tags = [] }) {
  return (
    <div className="feature-card">
      <div className="feature-card__icon">{icon}</div>
      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__desc">{desc}</p>
      {tags.length > 0 && (
        <div className="feature-card__list">
          {tags.map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- STATS (count-up) --------------------------- */

function Stats() {
  return (
    <section className="landing-stats" id="stats">
      <div className="landing-stats__inner reveal-stagger">
        <div>
          <div className="landing-stat__num">
            <CountUp end={7028} duration={1500} />
          </div>
          <div className="landing-stat__label">
            violence cases reported in the first four months of 2025
          </div>
          <span className="landing-stat__source">Bangladesh media monitoring, 2025</span>
        </div>
        <div>
          <div className="landing-stat__num">
            <CountUp end={6574} duration={1500} />
          </div>
          <div className="landing-stat__label">
            real crime records training our safe-route algorithm
          </div>
          <span className="landing-stat__source">CrimeDataBD, Mendeley 2025</span>
        </div>
        <div>
          <div className="landing-stat__num">
            <CountUp end={90} duration={1500} suffix="%" />
          </div>
          <div className="landing-stat__label">
            of women in Dhaka report harassment on public transport
          </div>
          <span className="landing-stat__source">BRAC study, 2023</span>
        </div>
      </div>
    </section>
  );
}

/* Count-up that triggers when in view */
function CountUp({ end, duration = 1500, suffix = '' }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !startedRef.current) {
          startedRef.current = true;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(end * eased));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{value.toLocaleString()}{suffix}</span>;
}

/* --------------------------- HOW IT WORKS --------------------------- */

function HowItWorks() {
  return (
    <section className="landing-section" id="how">
      <div className="landing-section__head reveal">
        <span className="eyebrow landing-section__eyebrow">How it works</span>
        <h2 className="landing-section__title">From unsafe to safe in three steps.</h2>
        <p className="landing-section__sub">
          Designed for the moment your hands are shaking and you need help in seconds.
        </p>
      </div>
      <div className="landing-steps reveal-stagger">
        <div className="step-card">
          <div className="step-card__num">1</div>
          <h3 className="step-card__title">Trigger</h3>
          <p className="step-card__desc">
            Hold the SOS button for 3 seconds, say <span className="font-bn">&ldquo;বাঁচাও&rdquo;</span>,
            or triple-tap from the calculator disguise. All three work without unlocking the screen.
          </p>
        </div>
        <div className="step-card">
          <div className="step-card__num">2</div>
          <h3 className="step-card__title">Alert</h3>
          <p className="step-card__desc">
            Your trusted circle gets an email with your live location. They open a link in any browser —
            no app to install. The link streams your position every 5 seconds.
          </p>
        </div>
        <div className="step-card">
          <div className="step-card__num">3</div>
          <h3 className="step-card__title">Get to safety</h3>
          <p className="step-card__desc">
            The app shows two routes home — one fast, one safe. The safe one is scored on 6,574 real crime
            records and avoids dark, unlit, and incident-dense streets.
          </p>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- DARK CONTRAST SECTION --------------------------- */

function DarkSection() {
  return (
    <section className="landing-dark">
      <div className="landing-dark__inner">
        <div className="reveal">
          <h2 className="landing-dark__title">
            One tap.<br />
            <em>Everyone you trust.</em><br />
            Watching over you.
          </h2>
          <p className="landing-dark__sub">
            SafeHer orchestrates voice, location, routing, and notification in a single 3-second pipeline.
            No new app to download. No phone number to share. Just a public link and a familiar interface.
          </p>
          <ul className="landing-dark__list">
            <li>Voice &rarr; Bengali SpeechRecognition runs on-device</li>
            <li>Location &rarr; Firebase RTDB, public read-only link</li>
            <li>Routes &rarr; OSM + crime-aware A* scoring</li>
            <li>Notify &rarr; trusted contacts get email + map link in &lt; 3s</li>
          </ul>
        </div>

        <div className="landing-dark__flow reveal" aria-hidden="true">
          <div className="landing-dark__flow-item landing-dark__flow-item--active">
            Voice trigger detected
            <span className="landing-dark__flow-num">01</span>
          </div>
          <div className="landing-dark__flow-item">
            Geolocation acquired
            <span className="landing-dark__flow-num">02</span>
          </div>
          <div className="landing-dark__flow-item">
            Trusted circle notified
            <span className="landing-dark__flow-num">03</span>
          </div>
          <div className="landing-dark__flow-item">
            Safe route computed
            <span className="landing-dark__flow-num">04</span>
          </div>
          <div className="landing-dark__flow-item">
            Live stream published
            <span className="landing-dark__flow-num">05</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- CTA --------------------------- */

function Cta({ onPrimary, onSecondary }) {
  return (
    <section className="landing-cta reveal">
      <div className="landing-cta__inner">
        <h2 className="landing-cta__title">No install. No signup. Open and go.</h2>
        <p className="landing-cta__sub">
          SafeHer is a website that opens in 2 seconds. Bookmark it on your home screen, and the SOS
          button is always one tap away.
        </p>
        <div className="landing-cta__btns">
          <Button
            variant="primary"
            size="lg"
            onClick={onPrimary}
            rightIcon={<ChevronRight size={16} />}
          >
            Open SafeHer
          </Button>
          <Button variant="secondary" size="lg" onClick={onSecondary}>
            See a live tracking link
          </Button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- FOOTER --------------------------- */

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__inner">
        <div className="landing-footer__brand-wrap">
          <a href="/" className="landing-footer__brand" aria-label="SafeHer home">
            <span className="landing-footer__brand-mark" aria-hidden="true">
              <ShieldAlert size={13} strokeWidth={2.5} />
            </span>
            SafeHer
          </a>
          <p className="landing-footer__text">
            &copy; {new Date().getFullYear()} SafeHer &middot; Built at CUET for the SciBlitz hackathon.
          </p>
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