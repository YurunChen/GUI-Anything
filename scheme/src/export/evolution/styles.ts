/**
 * Project Evolution HTML — styles.
 * Two-rail layout: sticky left "eras" track + scrollable right milestone stream.
 * Colors come from injected theme CSS variables (set on :root by client.ts).
 */

export function getEvolutionStyles(): string {
  return `
*, *::before, *::after { box-sizing: border-box; }
html {
  scroll-behavior: smooth;
  background: var(--page-background, var(--bg-primary, #1a1b26));
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, #536995) transparent;
}
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  background: transparent; /* the Aurora layer + html bg show through */
  color: var(--fg-primary, #c0caf5);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track {
  background: var(--scrollbar-track, transparent);
}
*::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #536995);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: content-box;
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover, #6f8ed6);
  background-clip: content-box;
}
*::-webkit-scrollbar-corner { background: transparent; }

/* ---- Aurora background (theme-derived; works on dark AND light themes) ---- */
.evo-aurora { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
.evo-aurora__blob {
  position: absolute; display: block; border-radius: 50%;
  filter: blur(75px); opacity: .55; will-change: transform;
  animation: aurora-drift 32s ease-in-out infinite alternate;
}
.evo-aurora__blob--1 {
  width: 46vw; height: 46vw; top: -8vw; left: -6vw;
  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent-primary, #7aa2f7) 80%, transparent), transparent 70%);
  animation-duration: 30s;
}
.evo-aurora__blob--2 {
  width: 40vw; height: 40vw; top: -4vw; right: -8vw;
  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent-secondary, #bb9af7) 78%, transparent), transparent 70%);
  animation-duration: 38s; animation-delay: -6s;
}
.evo-aurora__blob--3 {
  width: 44vw; height: 44vw; bottom: -12vw; left: 12vw;
  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--status-info, #7dcfff) 70%, transparent), transparent 70%);
  animation-duration: 34s; animation-delay: -12s;
}
.evo-aurora__blob--4 {
  width: 38vw; height: 38vw; bottom: -10vw; right: 6vw;
  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--status-success, #9ece6a) 60%, transparent), transparent 70%);
  animation-duration: 42s; animation-delay: -18s;
}
@keyframes aurora-drift {
  0%   { transform: translate3d(0,0,0) scale(1); }
  50%  { transform: translate3d(4vw, 5vw, 0) scale(1.18); }
  100% { transform: translate3d(-3vw, -4vw, 0) scale(1.05); }
}

/* ---- Motion utilities: scroll reveal + count-up base ---- */
.reveal { opacity: 0; transform: translateY(14px); transition: opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1); }
.reveal.is-revealed { opacity: 1; transform: none; }

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-primary,#7aa2f7) 40%, transparent); }
  50%      { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent-primary,#7aa2f7) 0%, transparent); }
}
@keyframes hero-pop { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes hero-glow-in { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .reveal { opacity: 1 !important; transform: none !important; }
  .evo-aurora__blob { animation: none !important; }
}

/* ---- Icons ---- */
.evo-ico { width: 18px; height: 18px; flex: 0 0 auto; display: inline-block; vertical-align: -3px; }
.evo-ico--sm { width: 13px; height: 13px; vertical-align: -2px; }
.evo-ico--lg { width: 22px; height: 22px; vertical-align: -5px; }
span.evo-ico.iconify { line-height: 0; }

/* ---- Hero ---- */
.evo-hero {
  position: relative; overflow: hidden;
  padding: 84px 20px 60px;
  text-align: center;
  background: transparent; /* Aurora shows through */
}
/* big soft glow blob behind the title, follows the theme accent */
.evo-hero::before {
  content: ''; position: absolute; left: 50%; top: -10%;
  width: min(680px, 92vw); height: 420px; transform: translateX(-50%);
  background: radial-gradient(closest-side,
    color-mix(in srgb, var(--accent-primary, #7aa2f7) 34%, transparent),
    transparent 72%);
  filter: blur(10px); pointer-events: none;
  animation: hero-glow-in 1s ease both;
}
.evo-hero__inner { position: relative; max-width: 820px; margin: 0 auto; }
.evo-hero__badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700;
  padding: 6px 16px; border-radius: 999px; margin-bottom: 20px;
  color: var(--accent-primary, #7aa2f7);
  background: color-mix(in srgb, var(--accent-primary, #7aa2f7) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-primary, #7aa2f7) 36%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px -6px color-mix(in srgb, var(--accent-primary,#7aa2f7) 45%, transparent);
  animation: hero-pop .7s cubic-bezier(.2,.7,.2,1) both;
}
.evo-hero__title {
  font-size: clamp(32px, 6vw, 60px); font-weight: 900; line-height: 1.08;
  margin: 0 0 16px; letter-spacing: -.02em;
  background: linear-gradient(115deg,
    var(--fg-primary, #c0caf5) 10%,
    var(--accent-primary, #7aa2f7) 55%,
    var(--accent-secondary, #bb9af7) 95%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: var(--fg-primary, #c0caf5);
  animation: hero-pop .7s cubic-bezier(.2,.7,.2,1) .08s both;
}
.evo-hero__sub {
  font-size: 16px; color: var(--fg-secondary, #a9b1d6); margin: 0 auto; max-width: 560px;
  animation: hero-pop .7s cubic-bezier(.2,.7,.2,1) .16s both;
}
.evo-hero__stats {
  display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; margin-top: 34px;
  animation: hero-pop .7s cubic-bezier(.2,.7,.2,1) .24s both;
}
.hero__stat {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  min-width: 92px; padding: 16px 22px; border-radius: 18px;
  background: var(--surface-muted, color-mix(in srgb, var(--bg-secondary, #16161e) 55%, transparent));
  border: 1px solid color-mix(in srgb, var(--border-normal, #3b3d52) 70%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: 0 8px 30px -14px color-mix(in srgb, var(--accent-primary,#7aa2f7) 50%, transparent);
  transition: transform .3s ease, box-shadow .3s ease;
}
.hero__stat:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 38px -14px color-mix(in srgb, var(--accent-primary,#7aa2f7) 60%, transparent);
}
.hero__stat-num {
  font-size: 30px; font-weight: 900; line-height: 1.1;
  background: linear-gradient(120deg, var(--accent-primary, #7aa2f7), var(--accent-secondary, #bb9af7));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  color: var(--accent-primary, #7aa2f7);
}
.hero__stat-label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-dim, #565f89); }

/* ---- Top bar ---- */
.evo-topbar {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: 12px;
  padding: 11px 20px;
  background: var(--surface-muted, color-mix(in srgb, var(--bg-secondary, #16161e) 62%, transparent));
  border-bottom: 1px solid color-mix(in srgb, var(--border-normal, #3b3d52) 60%, transparent);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
}
.evo-crumb { display: flex; align-items: center; gap: 8px; font-size: 13px; min-width: 0; flex: 1; }
.evo-crumb__sep { color: var(--fg-dim, #565f89); }
.evo-crumb__root { color: var(--accent-primary, #7aa2f7); cursor: pointer; text-decoration: none; }
.evo-crumb__root:hover { text-decoration: underline; }
.evo-crumb__cur { color: var(--fg-secondary, #a9b1d6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.evo-back {
  display: none; align-items: center; gap: 4px;
  font-size: 12px; padding: 4px 10px; cursor: pointer;
  background: var(--surface-strong, var(--bg-tertiary, #20212e)); color: var(--fg-secondary, #a9b1d6);
  border: 1px solid var(--border-normal, #3b3d52); border-radius: 6px;
}
.evo-back:hover { border-color: var(--border-active, #7aa2f7); }
.is-session .evo-back { display: inline-flex; }
.evo-theme select {
  font-size: 12px; padding: 4px 8px; border-radius: 6px;
  background: var(--surface-strong, var(--bg-tertiary, #20212e)); color: var(--fg-secondary, #a9b1d6);
  border: 1px solid var(--border-normal, #3b3d52); cursor: pointer;
}

/* ---- Layout ---- */
.evo-layout {
  display: grid;
  grid-template-columns: 38% 62%;
  max-width: 1240px; margin: 0 auto;
  padding: 0 20px;
  gap: 36px;
}

/* ---- Left rail: eras ---- */
.evo-rail { position: relative; }
.evo-rail__sticky {
  position: sticky; top: 72px;
  padding: 28px 0 40px;
  max-height: none;
  overflow: visible;
}
.evo-rail__head { margin: 0 0 18px; }
.evo-rail__kicker { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--fg-dim, #565f89); }
.evo-rail__title { font-size: 18px; font-weight: 600; margin: 2px 0 0; color: var(--fg-primary, #c0caf5); }
.evo-progress { height: 4px; border-radius: 4px; margin: 14px 0 22px; background: var(--surface-strong, var(--bg-tertiary, #20212e)); overflow: hidden; }
.evo-progress__fill {
  height: 100%; width: 0%; border-radius: 4px;
  background: linear-gradient(90deg, var(--accent-primary, #7aa2f7), var(--accent-secondary, #bb9af7));
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-primary,#7aa2f7) 70%, transparent);
  transition: width .45s cubic-bezier(.4,0,.2,1);
}

.era {
  position: relative; display: flex; gap: 14px;
  padding: 0 0 18px 0; margin: 0;
  opacity: .42; filter: saturate(.55);
  transition: opacity .4s ease, filter .4s ease;
  cursor: pointer;
}
/* connecting line between era markers */
.era::after {
  content: ''; position: absolute; left: 17px; top: 36px; bottom: -2px;
  width: 2px; background: var(--border-muted, #2a2b3c);
  transition: background .4s ease;
}
.era:last-child::after { display: none; }
.era__marker {
  flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--icon-background, var(--bg-secondary, #16161e));
  border: 2px solid var(--border-normal, #3b3d52);
  color: var(--fg-muted, #787c99);
  transition: all .4s cubic-bezier(.4,0,.2,1);
  z-index: 1;
}
.era__body { padding-top: 4px; min-width: 0; }
.era__index { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--fg-dim, #565f89); }
.era.is-past { opacity: .72; }
.era.is-past .era__marker { color: var(--accent-primary, #7aa2f7); border-color: color-mix(in srgb, var(--accent-primary,#7aa2f7) 50%, var(--border-normal,#3b3d52)); }
.era.is-past::after { background: color-mix(in srgb, var(--accent-primary,#7aa2f7) 40%, var(--border-muted,#2a2b3c)); }
.era.is-active { opacity: 1; filter: none; }
.era.is-active .era__marker {
  color: var(--accent-on, #fff);
  background: var(--accent-primary, #7aa2f7);
  border-color: var(--accent-primary, #7aa2f7);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-primary, #7aa2f7) 22%, transparent);
  transform: scale(1.06);
}
.era__title { font-size: 15px; font-weight: 600; color: var(--fg-primary, #c0caf5); margin-top: 1px; }
.era__abstract { font-size: 12.5px; color: var(--fg-muted, #787c99); margin-top: 3px; }
.era__scenes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.scene {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--surface-strong, var(--bg-tertiary, #20212e)); color: var(--fg-muted, #787c99);
  border: 1px solid var(--border-muted, #2a2b3c);
  opacity: 0; transform: translateY(4px);
  transition: opacity .4s ease, transform .4s ease, color .4s ease, border-color .4s ease;
}
.era.is-active .scene { color: var(--fg-secondary, #a9b1d6); border-color: var(--border-normal, #3b3d52); }
.era.is-active .scene.enter, .era.is-past .scene { opacity: 1; transform: none; }

/* ---- Right stream: milestones ---- */
.evo-stream { position: relative; padding: 28px 0 60vh 44px; min-width: 0; }
/* vertical timeline spine */
.evo-stream::before {
  content: ''; position: absolute; left: 17px; top: 36px; bottom: 60vh;
  width: 2px; background: linear-gradient(
    var(--border-normal, #3b3d52),
    var(--border-muted, #2a2b3c));
}
.evo-date {
  position: relative; font-size: 12px; font-weight: 600; letter-spacing: .06em;
  color: var(--fg-dim, #565f89); margin: 28px 0 14px -44px; padding-left: 44px;
}
.evo-date:first-child { margin-top: 0; }

.node {
  position: relative; padding: 17px 20px; margin: 0 0 16px;
  /* "light frost": translucent over the Aurora, but NO backdrop-filter so a long
     timeline of many nodes stays smooth while scrolling. */
  background: color-mix(in srgb, var(--surface-background, var(--bg-secondary, #16161e)) 82%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-normal, #3b3d52) 55%, transparent);
  border-radius: 16px;
  box-shadow: 0 2px 10px -4px color-mix(in srgb, var(--bg-primary,#000) 50%, transparent);
  transition: border-color .35s ease, transform .35s ease, box-shadow .35s ease;
}
.node:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--accent-primary,#7aa2f7) 45%, transparent);
  box-shadow: 0 14px 34px -16px color-mix(in srgb, var(--accent-primary,#7aa2f7) 50%, transparent);
}
/* timeline dot (icon circle) hanging into the spine gutter */
.node__dot {
  position: absolute; left: -44px; top: 14px;
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--icon-background, var(--bg-secondary, #16161e));
  border: 2px solid var(--border-normal, #3b3d52);
  color: var(--fg-muted, #787c99);
  transition: all .35s cubic-bezier(.4,0,.2,1); z-index: 1;
}
.node.is-active {
  border-color: var(--accent-primary, #7aa2f7);
  box-shadow: 0 8px 28px color-mix(in srgb, var(--accent-primary, #7aa2f7) 18%, transparent);
}
.node.is-active .node__dot {
  color: var(--accent-on, #fff);
  background: var(--accent-primary, #7aa2f7);
  border-color: var(--accent-primary, #7aa2f7);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-primary, #7aa2f7) 20%, transparent);
}
.node__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.node__title { font-size: 15.5px; font-weight: 600; margin: 0; color: var(--fg-primary, #c0caf5); }
.node__note { font-size: 13px; color: var(--fg-muted, #787c99); margin: 8px 0 0; }

.delta {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
  padding: 2px 9px 2px 7px; border-radius: 999px; white-space: nowrap;
}
.delta .evo-ico { opacity: .9; }
.delta--pivot    { background: color-mix(in srgb, var(--accent-primary,#7aa2f7) 20%, transparent); color: var(--accent-primary,#7aa2f7); }
.delta--refine   { background: color-mix(in srgb, var(--status-info,#7dcfff) 18%, transparent); color: var(--status-info,#7dcfff); }
.delta--continue { background: color-mix(in srgb, var(--fg-muted,#787c99) 16%, transparent); color: var(--fg-muted,#787c99); }
.delta--blocked  { background: color-mix(in srgb, var(--status-error,#f7768e) 18%, transparent); color: var(--status-error,#f7768e); }
.delta--done     { background: color-mix(in srgb, var(--status-success,#9ece6a) 18%, transparent); color: var(--status-success,#9ece6a); }
.delta--idle     { background: var(--surface-strong, var(--bg-tertiary,#20212e)); color: var(--fg-dim,#565f89); }

/* substeps reveal automatically when the node is scroll-spy active (no click) */
.node__children { margin: 12px 0 0; }
.node__children-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--fg-dim, #565f89);
  border-top: 1px solid var(--border-muted, #2a2b3c); padding-top: 10px;
  transition: color .35s ease;
}
.node__children-label::before {
  content: '▸'; display: inline-block; font-size: 10px;
  transition: transform .35s cubic-bezier(.4,0,.2,1);
}
.node.is-active .node__children-label { color: var(--fg-muted, #787c99); }
.node.is-active .node__children-label::before { transform: rotate(90deg); }
.node__children-wrap {
  display: grid; grid-template-rows: 0fr;
  transition: grid-template-rows .4s cubic-bezier(.4,0,.2,1);
}
.node.is-active .node__children-wrap { grid-template-rows: 1fr; }
.node__children-inner { overflow: hidden; min-height: 0; }
.substep { display: flex; gap: 8px; align-items: center; padding: 6px 0 0 14px; font-size: 12.5px; }
.substep:first-child { padding-top: 10px; }
.substep__title { color: var(--fg-secondary, #a9b1d6); }
.substep__note { color: var(--fg-dim, #565f89); }

/* ---- KPI dashboard ---- */
.evo-kpi-wrap { max-width: 1240px; margin: 0 auto; padding: 28px 20px 0; }
.evo-kpi {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
}
.kpi {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; gap: 4px;
  padding: 16px 18px; border-radius: 18px;
  background: color-mix(in srgb, var(--bg-secondary, #16161e) 55%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-normal, #3b3d52) 65%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: 0 10px 30px -16px color-mix(in srgb, var(--accent-primary,#7aa2f7) 50%, transparent);
  transition: border-color .3s ease, transform .3s ease, box-shadow .3s ease;
}
/* glass edge highlight */
.kpi::before {
  content: ''; position: absolute; inset: 0 0 auto 0; height: 1px;
  background: linear-gradient(90deg, transparent,
    color-mix(in srgb, var(--accent-primary,#7aa2f7) 60%, transparent), transparent);
}
.kpi:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--accent-primary,#7aa2f7) 50%, transparent);
  box-shadow: 0 16px 40px -16px color-mix(in srgb, var(--accent-primary,#7aa2f7) 60%, transparent);
}
.kpi__ico { color: var(--accent-primary, #7aa2f7); }
.kpi__num {
  font-size: 24px; font-weight: 900; line-height: 1.1;
  background: linear-gradient(120deg, var(--accent-primary, #7aa2f7), var(--accent-secondary, #bb9af7));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  color: var(--fg-primary, #c0caf5);
}
.kpi__label { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--fg-dim, #565f89); }

/* ---- Node behavioural badge ---- */
.node__badge { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.nbadge__item {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--bg-tertiary, #20212e); color: var(--fg-muted, #787c99);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.nbadge__item .evo-ico { opacity: .8; }
.nbadge__item--err { color: var(--status-error, #f7768e); border-color: color-mix(in srgb, var(--status-error,#f7768e) 35%, transparent); }

/* ---- Error-intensity heat band (left edge of milestone cards) ---- */
.node { border-left-width: 3px; }
.node--heat-low  { border-left-color: color-mix(in srgb, var(--status-success,#9ece6a) 55%, var(--border-muted,#2a2b3c)); }
.node--heat-mid  { border-left-color: color-mix(in srgb, var(--status-warning,#e0af68) 65%, var(--border-muted,#2a2b3c)); }
.node--heat-high { border-left-color: color-mix(in srgb, var(--status-error,#f7768e) 70%, var(--border-muted,#2a2b3c)); }

/* ---- Legend (mandatory for color encoding) ---- */
.evo-legend {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
  margin-top: 20px; padding-top: 16px;
  border-top: 1px solid var(--border-muted, #2a2b3c);
  font-size: 11px; color: var(--fg-dim, #565f89);
}
.evo-legend__label { font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.evo-legend__item { display: inline-flex; align-items: center; gap: 5px; color: var(--fg-muted, #787c99); }
.evo-legend__swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.sw--low  { background: color-mix(in srgb, var(--status-success,#9ece6a) 70%, transparent); }
.sw--mid  { background: color-mix(in srgb, var(--status-warning,#e0af68) 80%, transparent); }
.sw--high { background: color-mix(in srgb, var(--status-error,#f7768e) 80%, transparent); }

/* ---- Tabs (outer shell) ---- */
.evo-tabs {
  position: sticky; top: 49px; z-index: 25;
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 8px 20px;
  background: color-mix(in srgb, var(--bg-secondary, #16161e) 58%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--border-normal, #3b3d52) 55%, transparent);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
}
.evo-tabs[hidden] { display: none; }
.evo-tab-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; padding: 6px 14px; cursor: pointer;
  border-radius: 999px; border: 1px solid transparent;
  background: none; color: var(--fg-muted, #787c99);
  transition: all .25s ease;
}
.evo-tab-btn:hover { color: var(--fg-secondary, #a9b1d6); background: var(--bg-tertiary, #20212e); }
.evo-tab-btn.is-active {
  color: var(--accent-primary, #7aa2f7);
  background: color-mix(in srgb, var(--accent-primary, #7aa2f7) 14%, transparent);
  border-color: color-mix(in srgb, var(--accent-primary, #7aa2f7) 30%, transparent);
}
.evo-tab { display: none; animation: evo-fade .35s ease; }
.evo-tab.is-on { display: block; }
.evo-tabpanels { min-height: 50vh; }

/* ---- Intent-transition card (P4) ---- */
.trans {
  position: relative; display: flex; gap: 12px; align-items: flex-start;
  margin: 0 0 16px -44px; padding-left: 44px;
}
.trans__rail {
  flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-left: -44px;
  background: var(--bg-primary, #1a1b26);
  border: 1px dashed color-mix(in srgb, var(--accent-secondary,#bb9af7) 50%, var(--border-normal,#3b3d52));
  color: var(--accent-secondary, #bb9af7); z-index: 1;
}
.trans__body {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 10px; flex: 1; min-width: 0;
  background: color-mix(in srgb, var(--accent-secondary, #bb9af7) 8%, transparent);
  border: 1px dashed color-mix(in srgb, var(--accent-secondary, #bb9af7) 28%, transparent);
}
.trans__label {
  font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--accent-secondary, #bb9af7);
  padding: 1px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent-secondary, #bb9af7) 16%, transparent);
}
.trans__why { font-size: 13px; color: var(--fg-secondary, #a9b1d6); }
.trans__ev {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; color: var(--fg-dim, #565f89);
}

/* ---- Knowledge flow (P3) ---- */
.kflow { max-width: 1240px; margin: 0 auto; padding: 32px 20px 60px; }
.kflow__intro { text-align: center; margin-bottom: 28px; }
.kflow__title {
  font-size: clamp(22px, 3.2vw, 32px); font-weight: 800; margin: 0 0 8px;
  color: var(--fg-primary, #c0caf5);
}
.kflow__sub { font-size: 14px; color: var(--fg-muted, #787c99); margin: 0; }

/* ---- Marketplace filter chips ---- */
.kmkt__filters {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-bottom: 28px;
}
.kmkt__chip {
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 999px;
  background: var(--bg-secondary, #16161e); color: var(--fg-secondary, #a9b1d6);
  border: 1px solid var(--border-muted, #2a2b3c);
  transition: background .2s ease, color .2s ease, border-color .2s ease;
}
.kmkt__chip:hover { border-color: var(--accent-primary, #7aa2f7); }
.kmkt__chip.is-active {
  background: var(--accent-primary, #7aa2f7); border-color: var(--accent-primary, #7aa2f7);
  color: var(--bg-primary, #1a1b26);
}
.kmkt__chip-n {
  font-size: 11px; padding: 0 7px; border-radius: 999px;
  background: color-mix(in srgb, currentColor 18%, transparent);
}

/* ---- Marketplace card grid ---- */
.kmkt__grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;
}
.kcard {
  display: flex; flex-direction: column; gap: 10px; text-align: left; cursor: pointer;
  padding: 16px; border-radius: 16px; min-width: 0;
  background: color-mix(in srgb, var(--bg-secondary, #16161e) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-normal, #3b3d52) 60%, transparent);
  border-top: 3px solid var(--border-normal, #3b3d52);
  backdrop-filter: blur(12px) saturate(1.15);
  -webkit-backdrop-filter: blur(12px) saturate(1.15);
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.kcard:hover {
  transform: translateY(-3px);
  border-color: var(--accent-primary, #7aa2f7);
  box-shadow: 0 8px 24px -10px color-mix(in srgb, var(--accent-primary,#7aa2f7) 50%, transparent);
}
.kcard.is-hidden { display: none; }
.kcard--in  { border-top-color: color-mix(in srgb, var(--status-info,#7dcfff) 70%, transparent); }
.kcard--out { border-top-color: color-mix(in srgb, var(--status-success,#9ece6a) 70%, transparent); }
.kcard__top { display: flex; align-items: center; gap: 8px; }
.kcard__ico {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 9px;
  background: var(--bg-tertiary, #20212e); color: var(--accent-primary, #7aa2f7); flex: none;
}
.kcard--out .kcard__ico { color: var(--status-success, #9ece6a); }
.kcard__kind {
  font-size: 11px; font-weight: 700; letter-spacing: .04em;
  color: var(--fg-muted, #787c99);
}
.kcard__badge {
  margin-left: auto; font-size: 10.5px; white-space: nowrap;
  padding: 2px 9px; border-radius: 999px;
  background: var(--bg-tertiary, #20212e); color: var(--fg-muted, #787c99);
}
.kcard__badge--saved   { color: var(--status-success, #9ece6a); }
.kcard__badge--updated { color: var(--status-info, #7dcfff); }
.kcard__title {
  font-size: 14.5px; font-weight: 700; margin: 0; color: var(--fg-primary, #c0caf5);
  word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.kcard__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
.kcard__tag {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--bg-tertiary, #20212e); color: var(--fg-muted, #787c99);
  border: 1px solid var(--border-muted, #2a2b3c);
}

/* ---- Card detail modal ---- */
.kmodal {
  position: fixed; inset: 0; z-index: 50; display: none;
  align-items: center; justify-content: center; padding: 20px;
  background: color-mix(in srgb, var(--bg-primary, #1a1b26) 70%, transparent);
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
}
.kmodal.is-open { display: flex; animation: kmodal-fade .18s ease; }
@keyframes kmodal-fade { from { opacity: 0; } to { opacity: 1; } }
.kmodal__panel {
  position: relative; width: min(560px, 92vw); max-height: 85vh; overflow: auto;
  padding: 30px; border-radius: 20px;
  background: color-mix(in srgb, var(--bg-secondary, #16161e) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-primary, #7aa2f7) 28%, transparent);
  backdrop-filter: blur(20px) saturate(1.25);
  -webkit-backdrop-filter: blur(20px) saturate(1.25);
  box-shadow: 0 32px 80px -28px color-mix(in srgb, var(--accent-primary,#7aa2f7) 50%, rgba(0,0,0,.6));
  animation: kmodal-pop .2s cubic-bezier(.2, .8, .3, 1);
}
@keyframes kmodal-pop { from { transform: scale(.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.kmodal__x {
  position: absolute; top: 14px; right: 14px; cursor: pointer;
  width: 30px; height: 30px; border-radius: 8px; font-size: 15px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-tertiary, #20212e); color: var(--fg-muted, #787c99);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.kmodal__x:hover { color: var(--fg-primary, #c0caf5); border-color: var(--accent-primary, #7aa2f7); }
.kmodal__head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.kmodal__title {
  font-size: 19px; font-weight: 800; margin: 0 0 10px; color: var(--fg-primary, #c0caf5);
  word-break: break-word; padding-right: 28px;
}
.kmodal__meta { font-size: 12.5px; color: var(--fg-muted, #787c99); margin-bottom: 14px; }
.kmodal__ask {
  font-size: 13px; line-height: 1.6; color: var(--fg-secondary, #a9b1d6);
  margin: 0 0 14px; padding: 10px 12px; border-radius: 10px;
  background: var(--bg-tertiary, #20212e);
  border-left: 3px solid color-mix(in srgb, var(--accent-secondary,#bb9af7) 60%, transparent);
}
.kmodal__ask-label {
  display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .06em;
  color: var(--fg-muted, #787c99); margin-bottom: 4px;
}
.kmodal__excerpt {
  font-size: 13.5px; line-height: 1.7; color: var(--fg-secondary, #a9b1d6);
  margin: 0 0 14px; white-space: pre-wrap; word-break: break-word;
}
.kmodal__jump {
  margin-top: 16px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
  font-size: 13px; padding: 8px 14px; border-radius: 10px;
  background: var(--bg-tertiary, #20212e); color: var(--accent-secondary, #bb9af7);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.kmodal__jump:hover { border-color: var(--accent-secondary, #bb9af7); }

/* ---- Coding persona (P5) ---- */
.persona { max-width: 640px; margin: 0 auto; padding: 40px 20px 60px; }
.persona__card {
  position: relative; overflow: hidden; text-align: center;
  padding: 40px 30px 30px; border-radius: 24px;
  background:
    radial-gradient(120% 120% at 50% -10%,
      color-mix(in srgb, var(--accent-secondary, #bb9af7) 22%, transparent) 0%, transparent 60%),
    color-mix(in srgb, var(--bg-secondary, #16161e) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-secondary, #bb9af7) 28%, transparent);
  backdrop-filter: blur(18px) saturate(1.25);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
  box-shadow: 0 24px 60px -28px color-mix(in srgb, var(--accent-secondary,#bb9af7) 65%, transparent);
}
.persona__card::before {
  content: ''; position: absolute; inset: 0 0 auto 0; height: 1px;
  background: linear-gradient(90deg, transparent,
    color-mix(in srgb, var(--accent-secondary,#bb9af7) 70%, transparent), transparent);
}
.persona__badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; border-radius: 50%; margin-bottom: 12px;
  color: var(--accent-secondary, #bb9af7);
  background: color-mix(in srgb, var(--accent-secondary, #bb9af7) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-secondary, #bb9af7) 30%, transparent);
}
.persona__code {
  display: inline-block; font-size: 13px; font-weight: 800; letter-spacing: .3em;
  padding: 3px 12px 3px 14px; border-radius: 999px; margin-bottom: 10px;
  color: var(--accent-secondary, #bb9af7);
  background: color-mix(in srgb, var(--accent-secondary, #bb9af7) 12%, transparent);
}
.persona__title {
  font-size: clamp(22px, 3.4vw, 30px); font-weight: 800; margin: 0 0 6px;
  color: var(--fg-primary, #c0caf5);
}
.persona__tagline { font-size: 14px; color: var(--accent-secondary, #bb9af7); margin: 0 0 24px; }
.persona__axes { display: flex; flex-direction: column; gap: 16px; text-align: left; margin: 0 0 22px; }
.persona__axis-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; margin-bottom: 6px;
}
.persona__axis-name { color: var(--fg-dim, #565f89); letter-spacing: .04em; }
.persona__pole { color: var(--fg-muted, #787c99); transition: color .3s ease; }
.persona__pole.is-lean { color: var(--fg-primary, #c0caf5); font-weight: 700; }
.persona__track {
  position: relative; height: 6px; border-radius: 6px;
  background: var(--bg-tertiary, #20212e); overflow: visible;
}
.persona__fill {
  height: 100%; border-radius: 6px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--accent-primary,#7aa2f7) 70%, transparent),
    var(--accent-secondary, #bb9af7));
  transition: width .6s cubic-bezier(.4,0,.2,1);
}
.persona__knob {
  position: absolute; top: 50%; width: 14px; height: 14px; border-radius: 50%;
  transform: translate(-50%, -50%);
  background: var(--accent-secondary, #bb9af7);
  border: 2px solid var(--bg-secondary, #16161e);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-secondary, #bb9af7) 25%, transparent);
}
.persona__reading {
  font-size: 14px; line-height: 1.7; color: var(--fg-secondary, #a9b1d6);
  margin: 0 0 18px; text-align: left;
}
.persona__sig {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12.5px; cursor: pointer; padding: 6px 14px; border-radius: 999px;
  background: var(--bg-tertiary, #20212e); color: var(--accent-secondary, #bb9af7);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.persona__sig:hover { border-color: var(--accent-secondary, #bb9af7); }
.persona__foot { margin-top: 18px; font-size: 11px; color: var(--fg-dim, #565f89); }

/* ---- Persona v2: avatar / rarity / meta / dna / spectrum ---- */
.persona__avatar {
  width: 132px; height: 132px; margin: 0 auto 14px; border-radius: 24px; overflow: hidden;
  background: color-mix(in srgb, var(--accent-secondary, #bb9af7) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-secondary, #bb9af7) 30%, transparent);
  box-shadow: 0 10px 30px -12px color-mix(in srgb, var(--accent-secondary,#bb9af7) 55%, transparent);
}
.persona__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.persona__rarity {
  position: absolute; top: 16px; right: 16px;
  font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  padding: 3px 10px; border-radius: 999px;
  color: var(--bg-primary, #1a1b26); background: var(--fg-muted, #787c99);
}
.persona__rarity--common    { background: #9aa0b3; }
.persona__rarity--uncommon  { background: var(--status-success, #9ece6a); }
.persona__rarity--rare      { background: var(--status-info, #7dcfff); }
.persona__rarity--epic      { background: var(--accent-secondary, #bb9af7); }
.persona__rarity--legendary { background: linear-gradient(90deg, #f7b733, #fc4a1a); color: #1a1b26; }
.persona__rarity--hidden    { background: #2a2b3c; color: var(--fg-secondary, #a9b1d6); border: 1px solid var(--border-normal, #3b3d52); }
.persona__meta {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center;
  margin: 0 0 22px;
}
.persona__style {
  font-size: 12px; padding: 3px 10px; border-radius: 999px;
  color: var(--fg-secondary, #a9b1d6); background: var(--bg-tertiary, #20212e);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.persona__quote { font-size: 13px; color: var(--fg-muted, #787c99); font-style: italic; }
.persona__dna {
  font-size: 12.5px; letter-spacing: .04em; color: var(--fg-muted, #787c99);
  margin: 0 0 18px; padding: 8px 12px; border-radius: 10px;
  background: var(--bg-tertiary, #20212e);
}
.persona__spectrum { text-align: left; margin: 4px 0 18px; }
.persona__spec-label {
  font-size: 11px; font-weight: 700; letter-spacing: .06em;
  color: var(--fg-dim, #565f89); margin-bottom: 8px;
}
.persona__spec-row { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
.persona__spec-name {
  flex: 0 0 38%; font-size: 12.5px; color: var(--fg-secondary, #a9b1d6);
  display: flex; align-items: baseline; gap: 6px; min-width: 0;
}
.persona__spec-name em {
  font-style: normal; font-size: 10px; letter-spacing: .12em;
  color: var(--fg-dim, #565f89);
}
.persona__spec-bar {
  flex: 1; height: 6px; border-radius: 6px; background: var(--bg-tertiary, #20212e); overflow: hidden;
}
.persona__spec-bar i {
  display: block; height: 100%; border-radius: 6px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--accent-primary,#7aa2f7) 70%, transparent), var(--accent-secondary, #bb9af7));
}
.persona__spec-pct { flex: 0 0 auto; font-size: 11px; color: var(--fg-muted, #787c99); }

/* ---- View switching ---- */
.evo-view { display: none; animation: evo-fade .35s ease; }
.evo-view.is-on { display: block; }
@keyframes evo-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.evo-empty { text-align: center; color: var(--fg-dim, #565f89); padding: 80px 20px; font-size: 14px; }
.evo-footer { text-align: center; font-size: 11px; color: var(--fg-dim, #565f89); padding: 24px; display: flex; flex-direction: column; gap: 6px; }
.evo-footer__prov { display: inline-flex; align-items: center; justify-content: center; gap: 5px; color: var(--fg-muted, #787c99); }
.evo-footer__keys { opacity: .85; }

/* ---- Responsive: collapse left rail to a top mini progress ---- */
@media (max-width: 820px) {
  .evo-layout { grid-template-columns: 1fr; gap: 0; }
  .evo-hero { padding: 36px 16px 28px; }
  .evo-hero__stats { gap: 10px; }
  .hero__stat { min-width: 70px; padding: 9px 12px; }
  .evo-rail__sticky {
    position: sticky; top: 56px; max-height: none; padding: 14px 0;
    background: var(--page-background, var(--bg-primary, #1a1b26)); z-index: 20;
    border-bottom: 1px solid var(--border-muted, #2a2b3c);
  }
  .era { display: none; padding-bottom: 0; }
  .era::after { display: none; }
  .era.is-active { display: flex; margin-bottom: 0; }
  .era.is-active .era__scenes { display: none; }
}
`;
}
