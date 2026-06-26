import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from './hooks/useInView.js';

const CHAR_DELAY_JITTER_MS = 16;
const STEP_PAUSE_MS = 520;
const NOTE_PAUSE_MS = 360;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

function PainFragment({ fragment, visible, active }) {
  return (
    <li className={active ? 'is-typing' : ''}>
      <span>{visible ? fragment.slice(0, visible) : fragment}</span>
      {active ? <span className="pain-pillar-cursor" aria-hidden="true" /> : null}
    </li>
  );
}

export function PainPillarTypewriter({ pillar, charDelay = 52, ariaLabel }) {
  const reducedMotion = usePrefersReducedMotion();
  const pillarRef = useRef(null);
  const inView = useInView(pillarRef);
  const steps = useMemo(
    () => [
      ...pillar.fragments.map((fragment) => ({ kind: 'fragment', text: fragment })),
      { kind: 'punchline', text: pillar.punchline },
      { kind: 'note', text: pillar.note },
    ],
    [pillar.fragments, pillar.note, pillar.punchline],
  );
  const [stepIndex, setStepIndex] = useState(reducedMotion ? steps.length : 0);
  const [charIndex, setCharIndex] = useState(0);
  const started = reducedMotion || inView;

  useEffect(() => {
    if (reducedMotion || !started || stepIndex >= steps.length) return undefined;

    const current = steps[stepIndex];
    if (charIndex < current.text.length) {
      const jitter = Math.floor(Math.random() * CHAR_DELAY_JITTER_MS);
      const timer = window.setTimeout(
        () => setCharIndex((value) => value + 1),
        charDelay + jitter,
      );
      return () => window.clearTimeout(timer);
    }

    const pause = current.kind === 'note' ? NOTE_PAUSE_MS : STEP_PAUSE_MS;
    const timer = window.setTimeout(() => {
      setStepIndex((value) => value + 1);
      setCharIndex(0);
    }, pause);
    return () => window.clearTimeout(timer);
  }, [charDelay, charIndex, reducedMotion, started, stepIndex, steps]);

  const complete = reducedMotion || stepIndex >= steps.length;
  const currentStep = steps[stepIndex];

  return (
    <article
      ref={pillarRef}
      className={`pain-pillar${complete ? ' is-complete' : ''}`}
      aria-label={ariaLabel}
    >
      <h3 className="pain-pillar-title">{pillar.title}</h3>
      <div className="pain-pillar-body">
        <ul
          className="pain-fragments"
          style={{ '--pain-fragment-rows': pillar.fragments.length }}
        >
          {pillar.fragments.map((fragment, index) => {
            const isCurrent = currentStep?.kind === 'fragment' && stepIndex === index;
            const isVisible = complete || stepIndex > index;
            if (!started || (!isVisible && !isCurrent)) {
              return <li className="is-placeholder" key={fragment}>{fragment}</li>;
            }
            return (
              <PainFragment
                active={isCurrent}
                fragment={fragment}
                key={fragment}
                visible={isCurrent ? charIndex : undefined}
              />
            );
          })}
        </ul>
        <p
          className={`pain-punchline${currentStep?.kind === 'punchline' ? ' is-typing' : ''}${!complete && stepIndex < pillar.fragments.length ? ' is-placeholder' : ''}`}
        >
          <span>
            {currentStep?.kind === 'punchline'
              ? pillar.punchline.slice(0, charIndex)
              : pillar.punchline}
          </span>
          {currentStep?.kind === 'punchline' ? (
            <span className="pain-pillar-cursor" aria-hidden="true" />
          ) : null}
          {pillar.reaction ? (
            <span className="pain-reaction" aria-hidden="true">{pillar.reaction}</span>
          ) : null}
        </p>
        <p
          className={`pain-note${currentStep?.kind === 'note' ? ' is-typing' : ''}${!complete && stepIndex <= pillar.fragments.length ? ' is-placeholder' : ''}`}
        >
          {currentStep?.kind === 'note' ? pillar.note.slice(0, charIndex) : pillar.note}
          {currentStep?.kind === 'note' ? (
            <span className="pain-pillar-cursor" aria-hidden="true" />
          ) : null}
        </p>
      </div>
    </article>
  );
}
