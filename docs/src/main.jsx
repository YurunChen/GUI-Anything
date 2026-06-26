import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  BookOpen,
  GitBranch,
  Map,
  Network,
} from 'lucide-react';
import './styles.css';
import { FlowTerminal, terminalScenarios } from './FlowTerminal.jsx';
import { PainPillarTypewriter } from './PainPillarTypewriter.jsx';
import { CapabilityPreview } from './CapabilityPreview.jsx';
import { SessionBeats } from './SessionBeats.jsx';
import siteLogo from '../../assets/logo.png';
import { useInView } from './hooks/useInView.js';
import {
  persistLocale,
  resolveInitialLocale,
  siteContent,
} from './site-content.js';

const capabilityIcons = {
  Intent: Network,
  Flow: Network,
  Notify: Bell,
  Map: Map,
  Wiki: BookOpen,
  意图: Network,
  心流: Network,
  通知: Bell,
  可视化: Map,
  沉淀: BookOpen,
};

function App() {
  const [locale, setLocale] = useState(resolveInitialLocale);
  const [active, setActive] = useState(terminalScenarios[1]);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const demoRef = useRef(null);
  const demoInView = useInView(demoRef);
  const t = siteContent[locale];

  const activeIndex = useMemo(
    () => terminalScenarios.findIndex((scenario) => scenario.id === active.id),
    [active],
  );

  const pauseAutoplay = useCallback(() => setAutoplayPaused(true), []);

  const selectScenario = useCallback((scenario) => {
    pauseAutoplay();
    setActive(scenario);
  }, [pauseAutoplay]);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    persistLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!demoInView || autoplayPaused) return undefined;

    const timer = window.setInterval(() => {
      setActive((current) => {
        const index = terminalScenarios.findIndex((scenario) => scenario.id === current.id);
        return terminalScenarios[(index + 1) % terminalScenarios.length];
      });
    }, 5500);

    return () => window.clearInterval(timer);
  }, [demoInView, autoplayPaused]);

  return (
    <div className="site terminal-site">
      <a className="skip-link" href="#main">{t.ui.skip}</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={t.ui.brandAria}>
          <img className="brand-mark brand-logo" src={siteLogo} alt="" aria-hidden="true" />
          <span className="brand-name">gui-anything</span>
        </a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="#problem">{t.nav.problem}</a>
          <a href="#demo">{t.nav.demo}</a>
          <a href="#capabilities">{t.nav.capabilities}</a>
          <a href="#contribute">{t.nav.contribute}</a>
        </nav>
        <div className="lang-switch" role="group" aria-label={t.ui.langLabel}>
          <button
            type="button"
            className={locale === 'en' ? 'active' : ''}
            aria-pressed={locale === 'en'}
            onClick={() => setLocale('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={locale === 'zh' ? 'active' : ''}
            aria-pressed={locale === 'zh'}
            onClick={() => setLocale('zh')}
          >
            中文
          </button>
        </div>
      </header>

      <main id="main">
        <section id="top" className="hero">
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-grid">
              <div className="hero-copy">
                <p className="hero-label">
                  <span className="prompt" aria-hidden="true">$</span>
                  {' '}
                  {t.hero.command}
                </p>
                <h1>{t.hero.title}</h1>
                <p className="lede">{t.hero.lede}</p>
                <div className="hero-actions">
                  <a
                    className="button button-primary"
                    href="https://github.com/YurunChen/GUI-Anything"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.hero.ctaPrimary}
                  </a>
                  <a className="button button-secondary" href="#demo">{t.hero.ctaSecondary}</a>
                </div>
                <ul className="hero-proof-list" aria-label={t.hero.proofLabel}>
                  {t.hero.proof.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <HeroProductScene content={t.hero.product} />
            </div>
          </div>
        </section>

        <div className="content-stack content-stack-problem">
          <section id="problem" className="stack-section stack-section-pain stack-section-reveal">
            <p className="section-kicker section-kicker-pain">{t.problem.tag}</p>
            <div className="pain-pillars">
              {t.problem.pillars.map((pillar, index) => (
                <PainPillarTypewriter
                  key={`${locale}-${pillar.id}`}
                  pillar={pillar}
                  charDelay={50 + index * 8}
                  ariaLabel={pillar.title}
                />
              ))}
            </div>
          </section>
        </div>

        <section id="demo" className="demo-section" ref={demoRef}>
          <div className="demo-section-inner">
            <div className="demo-stage-head">
              <h2 className="stack-heading">{t.demo.title}</h2>
              <p className="demo-hint">
                <span className="demo-hint-pulse" aria-hidden="true" />
                {t.demo.hint}
              </p>
            </div>
            <ScenarioTabs
              active={active}
              onSelect={selectScenario}
              ariaLabel={t.ui.demoTabsAria}
              variant="stage"
            />
            <div
              className="demo-stage"
              onMouseEnter={pauseAutoplay}
              onFocus={pauseAutoplay}
            >
              <FlowTerminal
                active={active}
                activeIndex={activeIndex}
                onSelect={selectScenario}
                showStrip={false}
                onInteract={pauseAutoplay}
              />
            </div>
          </div>
        </section>

        <div className="content-stack">
          <section id="capabilities" className="stack-section stack-section-capabilities stack-section-reveal">
            <p className="section-kicker section-kicker-cap">{t.capabilities.tag}</p>
            <h2 className="section-title">{t.capabilities.title}</h2>
            <p className="stack-lead stack-lead-tight">{t.capabilities.body}</p>
            <ul className="capability-grid">
              {t.capabilities.items.map((item) => (
                <CapabilityItem
                  key={item.id ?? item.title}
                  title={item.title}
                  text={item.text}
                  preview={item.preview}
                />
              ))}
            </ul>
          </section>

          <hr className="stack-divider" />

          <section id="how" className="stack-section stack-section-how stack-section-reveal">
            <SessionBeats lifecycle={t.lifecycle} />
          </section>

          <hr className="stack-divider" />

          <section id="contribute" className="stack-section stack-section-contribute stack-section-reveal">
            <h2 className="section-title">{t.contribute.title}</h2>
            <p className="stack-lead stack-lead-tight">{t.contribute.body}</p>
            <div className="link-row">
              <a className="button button-primary" href="https://github.com/YurunChen/GUI-Anything">
                <GitBranch size={18} strokeWidth={1.5} aria-hidden="true" />
                {t.contribute.github}
              </a>
              <a
                className="button button-secondary"
                href="https://github.com/YurunChen/GUI-Anything/blob/main/CONTRIBUTING.md"
              >
                {t.contribute.guide}
              </a>
            </div>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <span className="footer-prompt" aria-hidden="true">$</span>
        <span>{t.footer.line}</span>
        <a href="#top">{t.footer.top}</a>
      </footer>
    </div>
  );
}

function ScenarioTabs({ active, onSelect, ariaLabel, variant = 'stage' }) {
  return (
    <div className={`scenario-tabs scenario-tabs-${variant}`} role="tablist" aria-label={ariaLabel}>
      {terminalScenarios.map((scenario) => (
        <button
          type="button"
          role="tab"
          aria-selected={scenario.id === active.id}
          className={scenario.id === active.id ? 'active' : ''}
          key={scenario.id}
          onClick={() => onSelect(scenario)}
        >
          {scenario.label}
        </button>
      ))}
    </div>
  );
}

function CapabilityItem({ title, text, preview }) {
  const Icon = capabilityIcons[title];
  return (
    <li className="capability-card">
      <CapabilityPreview preview={preview} />
      <div className="capability-card-head">
        {Icon ? (
          <span className="capability-icon" aria-hidden="true">
            <Icon size={18} strokeWidth={1.5} />
          </span>
        ) : null}
        <h3>{title}</h3>
      </div>
      <p>{text}</p>
    </li>
  );
}

function HeroProductScene({ content }) {
  return (
    <div className="hero-product" aria-label={content.ariaLabel}>
      <div className="hero-product-bar">
        <span>{content.title}</span>
        <span>{content.mode}</span>
      </div>
      <div className="hero-product-grid">
        <div className="hero-product-pane hero-product-pane-claude">
          <div className="hero-pane-title">{content.claudeTitle}</div>
          {content.claudeLines.map((line) => (
            <div className="hero-log-line" key={line}>{line}</div>
          ))}
        </div>
        <div className="hero-product-pane hero-product-pane-observer">
          <div className="hero-pane-title">{content.observerTitle}</div>
          {content.cards.map((card) => (
            <div className={`hero-observer-card ${card.active ? 'is-active' : ''}`} key={card.title}>
              <span>{card.badge}</span>
              <strong>{card.title}</strong>
              <small>{card.meta}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="hero-product-footer">
        {content.footer.map(([label, value]) => (
          <span key={label}>
            <b>{label}</b>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
