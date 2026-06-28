import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  BookOpen,
  FileText,
  GitBranch,
  Github,
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
  Flow: Network,
  Notify: Bell,
  Map: Map,
  Wiki: BookOpen,
  心流: Network,
  通知: Bell,
  可视化: Map,
  沉淀: BookOpen,
};

const DEMO_CYCLE_IDS = ['flow', 'knowledge', 'timeline', 'replay', 'note'];

function findScenario(id) {
  return terminalScenarios.find((s) => s.id === id) ?? terminalScenarios[1];
}

function App() {
  const [locale, setLocale] = useState(resolveInitialLocale);
  const [active, setActive] = useState(() => findScenario('flow'));
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const demoRef = useRef(null);
  const demoInView = useInView(demoRef);
  const t = siteContent[locale];

  const activeIndex = useMemo(
    () => terminalScenarios.findIndex((scenario) => scenario.id === active.id),
    [active],
  );

  const scenarioNarrative = t.scenarioCopy[active.id] ?? t.scenarioCopy.flow;
  const scenarioCallouts = t.demo.callouts?.[active.id] ?? [];

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
        const cycleIndex = DEMO_CYCLE_IDS.indexOf(current.id);
        const nextId = cycleIndex >= 0
          ? DEMO_CYCLE_IDS[(cycleIndex + 1) % DEMO_CYCLE_IDS.length]
          : DEMO_CYCLE_IDS[0];
        return findScenario(nextId);
      });
    }, 6500);

    return () => window.clearInterval(timer);
  }, [demoInView, autoplayPaused]);

  return (
    <div className="site site-v4 site-landing">
      <a className="skip-link" href="#main">{t.ui.skip}</a>
      <header className="site-header site-header-v4">
        <a className="brand" href="#top" aria-label={t.ui.brandAria}>
          <img className="brand-mark brand-logo" src={siteLogo} alt="" aria-hidden="true" />
          <span className="brand-name">GUI-Anything</span>
        </a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="#demo">{t.nav.demo}</a>
          <a href="#moments">{t.nav.moments}</a>
          <a href="#problem">{t.nav.problem}</a>
          <a href="#capabilities">{t.nav.capabilities}</a>
          <a href="#lifecycle">{t.nav.lifecycle}</a>
          <a href="#contribute">{t.nav.contribute}</a>
        </nav>
        <div className="header-actions">
          <a
            className="header-github"
            href="https://github.com/YurunChen/GUI-Anything"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={16} strokeWidth={1.7} aria-hidden="true" />
            {t.hero.ctaPrimary}
          </a>
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
        </div>
      </header>

      <main id="main">
        <section id="top" className="landing-hero">
          <div className="landing-hero-head">
            <h1>{t.hero.title}</h1>
            <p className="lede lede-hero">{t.hero.lede}</p>
            <ul className="hero-proof-list hero-proof-list-v4" aria-label={t.hero.proofLabel}>
              {t.hero.proof.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div id="demo" className="demo-shell" ref={demoRef} aria-label={t.ui.demoAria}>
            <div className="demo-section-intro">
              <p className="section-kicker">{t.demo.tag}</p>
              <h2 className="demo-section-title">{t.demo.title}</h2>
              <p className="stack-lead demo-section-lead">{t.demo.body}</p>
            </div>

            <ScenarioTabs
              active={active}
              onSelect={selectScenario}
              ariaLabel={t.ui.demoTabsAria}
            />

            <div className="demo-narrative" role="status" aria-live="polite">
              <h3 className="demo-narrative-title">{scenarioNarrative.title}</h3>
              <p className="demo-narrative-thesis">{scenarioNarrative.thesis}</p>
              {scenarioCallouts.length ? (
                <ul className="demo-callouts">
                  {scenarioCallouts.map((item) => (
                    <li key={item.target} data-target={item.target}>{item.label}</li>
                  ))}
                </ul>
              ) : null}
              <dl className="demo-artifacts">
                {scenarioNarrative.artifacts.map(([label, value]) => (
                  <div className="demo-artifact-row" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div
              className="demo-stage demo-stage-hero"
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
            <p className="demo-hint-line">{t.demo.hint}</p>
          </div>
        </section>

        <section id="moments" className="moments-section">
          <div className="moments-head">
            <h2 className="section-title">{t.moments.title}</h2>
            <p className="stack-lead">{t.moments.body}</p>
          </div>
          <ul className="moments-grid">
            {t.moments.items.map((moment) => (
              <li key={moment.id}>
                <button
                  type="button"
                  className="moment-card"
                  onClick={() => {
                    pauseAutoplay();
                    setActive(findScenario(moment.scenarioId));
                    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <h3>{moment.title}</h3>
                  <p>{moment.text}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="content-stack content-stack-problem">
          <section id="problem" className="stack-section stack-section-pain">
            <p className="section-kicker section-kicker-pain">{t.problem.tag}</p>
            <div className="pain-pillars" aria-label={t.ui.painAria}>
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

        <div className="content-stack">
          <section id="capabilities" className="stack-section stack-section-capabilities">
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

          <section id="lifecycle" className="stack-section stack-section-how">
            <SessionBeats lifecycle={t.lifecycle} />
          </section>

          <hr className="stack-divider" />

          <section id="principles" className="stack-section stack-section-principles">
            <p className="section-kicker">{t.principles.tag}</p>
            <ul className="principle-list">
              {t.principles.items.map((item) => (
                <li className="principle-item" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <hr className="stack-divider" />

          <section id="contribute" className="stack-section stack-section-contribute">
            <p className="section-kicker">{t.contribute.tag}</p>
            <div className="contribute-layout">
              <div className="contribute-intro">
                <h2 className="section-title">{t.contribute.title}</h2>
                <p className="stack-lead stack-lead-tight">{t.contribute.body}</p>
                <div className="link-row">
                  <a
                    className="button button-primary"
                    href="https://github.com/YurunChen/GUI-Anything/issues"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <GitBranch size={18} strokeWidth={1.5} aria-hidden="true" />
                    {t.contribute.github}
                  </a>
                  <a
                    className="button button-secondary"
                    href="https://github.com/YurunChen/GUI-Anything/blob/main/CONTRIBUTING.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={18} strokeWidth={1.5} aria-hidden="true" />
                    {t.contribute.guide}
                  </a>
                </div>
              </div>
              <div className="contribute-facts">
                <div className="contribute-block">
                  <h3>{t.contribute.verifyTitle}</h3>
                  <ul className="cmd-list">
                    {t.contribute.verify.map((cmd) => (
                      <li key={cmd}><code>{cmd}</code></li>
                    ))}
                  </ul>
                </div>
                <div className="contribute-block">
                  <h3>{t.contribute.areasTitle}</h3>
                  <ul className="path-list">
                    {t.contribute.areas.map((area) => (
                      <li key={area.path}>
                        <code>{area.path}</code>
                        <span>{area.note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="site-footer site-footer-v4">
        <span>{t.footer.line}</span>
        <a
          href="https://github.com/YurunChen/GUI-Anything#quick-start"
          target="_blank"
          rel="noreferrer"
        >
          {t.footer.readme}
        </a>
        <a href="#top">{t.footer.top}</a>
      </footer>
    </div>
  );
}

function ScenarioTabs({ active, onSelect, ariaLabel }) {
  return (
    <div className="scenario-tabs scenario-tabs-v4" role="tablist" aria-label={ariaLabel}>
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

createRoot(document.getElementById('root')).render(<App />);
