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
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, #536995) transparent;
}
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  background: var(--page-background, var(--bg-primary, #1a1b26));
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

/* ---- Icons ---- */
.evo-ico { width: 18px; height: 18px; flex: 0 0 auto; display: inline-block; vertical-align: -3px; }
.evo-ico--sm { width: 13px; height: 13px; vertical-align: -2px; }
.evo-ico--lg { width: 22px; height: 22px; vertical-align: -5px; }
span.evo-ico.iconify { line-height: 0; }

/* ---- Hero ---- */
.evo-hero {
  position: relative; overflow: hidden;
  padding: 56px 20px 44px;
  text-align: center;
  background:
    radial-gradient(120% 120% at 50% -10%,
      color-mix(in srgb, var(--accent-primary, #7aa2f7) 16%, transparent) 0%, transparent 60%),
    var(--page-background, var(--bg-primary, #1a1b26));
  border-bottom: 1px solid var(--border-muted, #2a2b3c);
}
.evo-hero__inner { max-width: 760px; margin: 0 auto; }
.evo-hero__badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600;
  padding: 5px 14px; border-radius: 999px; margin-bottom: 16px;
  color: var(--accent-primary, #7aa2f7);
  background: color-mix(in srgb, var(--accent-primary, #7aa2f7) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-primary, #7aa2f7) 30%, transparent);
}
.evo-hero__title {
  font-size: clamp(26px, 4.4vw, 42px); font-weight: 800; line-height: 1.15;
  margin: 0 0 12px; letter-spacing: -.01em;
  background: linear-gradient(120deg,
    var(--fg-primary, #c0caf5),
    var(--accent-primary, #7aa2f7));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: var(--fg-primary, #c0caf5);
}
.evo-hero__sub { font-size: 15px; color: var(--fg-muted, #787c99); margin: 0 auto; max-width: 520px; }
.evo-hero__stats { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; margin-top: 28px; }
.hero__stat {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  min-width: 84px; padding: 12px 18px; border-radius: 14px;
  background: var(--surface-muted, color-mix(in srgb, var(--bg-secondary, #16161e) 70%, transparent));
  border: 1px solid var(--border-muted, #2a2b3c);
}
.hero__stat-num { font-size: 24px; font-weight: 800; color: var(--fg-primary, #c0caf5); }
.hero__stat-label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-dim, #565f89); }

/* ---- Top bar ---- */
.evo-topbar {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 20px;
  background: var(--surface-muted, color-mix(in srgb, var(--bg-secondary, #16161e) 88%, transparent));
  border-bottom: 1px solid var(--border-muted, #2a2b3c);
  backdrop-filter: blur(8px);
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
.evo-progress__fill { height: 100%; width: 0%; border-radius: 4px; background: var(--accent-primary, #7aa2f7); transition: width .45s cubic-bezier(.4,0,.2,1); }

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
  position: relative; padding: 16px 18px; margin: 0 0 16px;
  background: var(--surface-background, var(--bg-secondary, #16161e));
  border: 1px solid var(--border-muted, #2a2b3c);
  border-radius: 14px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--bg-primary,#000) 40%, transparent);
  transition: border-color .35s ease, transform .35s ease, box-shadow .35s ease;
}
.node:hover { transform: translateY(-2px); box-shadow: 0 8px 24px color-mix(in srgb, var(--bg-primary,#000) 45%, transparent); }
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
.node__drill {
  margin-top: 10px; font-size: 12px; cursor: pointer; user-select: none;
  color: var(--accent-secondary, #bb9af7); background: none; border: none; padding: 0;
}
.node__drill:hover { text-decoration: underline; }

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

/* ---- View switching ---- */
.evo-view { display: none; animation: evo-fade .35s ease; }
.evo-view.is-on { display: block; }
@keyframes evo-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.evo-empty { text-align: center; color: var(--fg-dim, #565f89); padding: 80px 20px; font-size: 14px; }
.evo-footer { text-align: center; font-size: 11px; color: var(--fg-dim, #565f89); padding: 24px; }

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
