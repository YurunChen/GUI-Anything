import React, { useEffect, useState } from 'react';

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

function DoneLines({ lines, reaction, ariaLabel, animateReaction }) {
  return (
    <div className={`pain-typewriter is-complete${animateReaction ? ' show-reaction' : ''}`} aria-label={ariaLabel}>
      {lines.map((line, index) => (
        <p className="pain-typewriter-line" key={line}>
          <span className="pain-typewriter-prefix">&gt;</span>
          <span className="pain-typewriter-text">{line}</span>
          {index === lines.length - 1 && reaction ? (
            <span className="pain-typewriter-reaction" aria-hidden="true">{reaction}</span>
          ) : null}
        </p>
      ))}
      <span className="sr-only">{lines.join(' ')}</span>
    </div>
  );
}

export function PainTypewriter({ lines, ariaLabel, reaction = '🤨 😭 🧭' }) {
  const reducedMotion = usePrefersReducedMotion();
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase] = useState('typing');

  const currentLine = lines[lineIndex] ?? '';
  const visible = currentLine.slice(0, charIndex);

  useEffect(() => {
    if (reducedMotion) return undefined;

    if (phase === 'typing') {
      if (charIndex < currentLine.length) {
        const timer = window.setTimeout(() => setCharIndex((value) => value + 1), 38);
        return () => window.clearTimeout(timer);
      }
      const timer = window.setTimeout(() => setPhase('hold'), 1400);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'hold') {
      const timer = window.setTimeout(() => {
        if (lineIndex < lines.length - 1) {
          setLineIndex((value) => value + 1);
          setCharIndex(0);
          setPhase('typing');
        } else {
          setPhase('done');
        }
      }, 520);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [reducedMotion, phase, charIndex, currentLine.length, lineIndex, lines.length]);

  if (reducedMotion || phase === 'done') {
    return (
      <DoneLines
        lines={lines}
        reaction={reaction}
        ariaLabel={ariaLabel}
        animateReaction={!reducedMotion && phase === 'done'}
      />
    );
  }

  return (
    <div className="pain-typewriter" aria-label={ariaLabel} aria-live="polite">
      {lines.slice(0, lineIndex).map((line) => (
        <p key={line} className="pain-typewriter-line is-done">
          <span className="pain-typewriter-prefix">&gt;</span>
          <span className="pain-typewriter-text">{line}</span>
        </p>
      ))}
      <p className="pain-typewriter-line is-active">
        <span className="pain-typewriter-prefix">&gt;</span>
        <span className="pain-typewriter-text">{visible}</span>
        <span className="pain-typewriter-cursor" aria-hidden="true" />
      </p>
      <span className="sr-only">{lines.join(' ')}</span>
    </div>
  );
}
