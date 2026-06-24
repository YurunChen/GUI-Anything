/**
 * Project Evolution HTML — styles.
 * Two-rail layout: sticky left "eras" track + scrollable right milestone stream.
 * Colors come from injected theme CSS variables (set on :root by client.ts).
 */

export function getEvolutionStyles(): string {
  return `
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  background: var(--bg-primary, #1a1b26);
  color: var(--fg-primary, #c0caf5);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

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
    var(--bg-primary, #1a1b26);
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
  background: color-mix(in srgb, var(--bg-secondary, #16161e) 70%, transparent);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.hero__stat-num { font-size: 24px; font-weight: 800; color: var(--fg-primary, #c0caf5); }
.hero__stat-label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-dim, #565f89); }

/* ---- Top bar ---- */
.evo-topbar {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 20px;
  background: color-mix(in srgb, var(--bg-secondary, #16161e) 88%, transparent);
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
  background: var(--bg-tertiary, #20212e); color: var(--fg-secondary, #a9b1d6);
  border: 1px solid var(--border-normal, #3b3d52); border-radius: 6px;
}
.evo-back:hover { border-color: var(--border-active, #7aa2f7); }
.is-session .evo-back { display: inline-flex; }
.evo-theme select {
  font-size: 12px; padding: 4px 8px; border-radius: 6px;
  background: var(--bg-tertiary, #20212e); color: var(--fg-secondary, #a9b1d6);
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
  max-height: calc(100vh - 72px);
  overflow-y: auto;
}
.evo-rail__head { margin: 0 0 18px; }
.evo-rail__kicker { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--fg-dim, #565f89); }
.evo-rail__title { font-size: 18px; font-weight: 600; margin: 2px 0 0; color: var(--fg-primary, #c0caf5); }
.evo-progress { height: 4px; border-radius: 4px; margin: 14px 0 22px; background: var(--bg-tertiary, #20212e); overflow: hidden; }
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
  background: var(--bg-secondary, #16161e);
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
  background: var(--bg-tertiary, #20212e); color: var(--fg-muted, #787c99);
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
  background: var(--bg-secondary, #16161e);
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
  background: var(--bg-secondary, #16161e);
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
.delta--idle     { background: var(--bg-tertiary,#20212e); color: var(--fg-dim,#565f89); }

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
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px 16px; border-radius: 14px;
  background: color-mix(in srgb, var(--bg-secondary, #16161e) 78%, transparent);
  border: 1px solid var(--border-muted, #2a2b3c);
  transition: border-color .3s ease, transform .3s ease;
}
.kpi:hover { transform: translateY(-2px); border-color: var(--border-normal, #3b3d52); }
.kpi__ico { color: var(--accent-primary, #7aa2f7); }
.kpi__num { font-size: 22px; font-weight: 800; color: var(--fg-primary, #c0caf5); line-height: 1.1; }
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
  background: color-mix(in srgb, var(--bg-secondary, #16161e) 88%, transparent);
  border-bottom: 1px solid var(--border-muted, #2a2b3c);
  backdrop-filter: blur(8px);
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
.kflow__cols {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 18px; align-items: start;
}
.kflow__arrow { align-self: center; color: var(--accent-primary, #7aa2f7); opacity: .7; }
.kflow__col { min-width: 0; }
.kflow__col-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; letter-spacing: .04em;
  color: var(--fg-secondary, #a9b1d6); margin-bottom: 14px;
}
.kflow__count {
  font-size: 11px; padding: 1px 8px; border-radius: 999px; margin-left: auto;
  background: var(--bg-tertiary, #20212e); color: var(--fg-muted, #787c99);
}
.kflow__card {
  padding: 14px 16px; margin-bottom: 12px; border-radius: 12px;
  background: var(--bg-secondary, #16161e);
  border: 1px solid var(--border-muted, #2a2b3c);
  border-left: 3px solid var(--border-normal, #3b3d52);
  transition: border-color .3s ease, transform .3s ease;
}
.kflow__card:hover { transform: translateY(-2px); }
.kflow__card--in  { border-left-color: color-mix(in srgb, var(--status-info,#7dcfff) 60%, transparent); }
.kflow__card--out { border-left-color: color-mix(in srgb, var(--status-success,#9ece6a) 60%, transparent); }
.kflow__head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.kflow__req { font-size: 14px; font-weight: 600; color: var(--fg-primary, #c0caf5); word-break: break-word; }
.kflow__score, .kflow__status {
  font-size: 10.5px; padding: 1px 8px; border-radius: 999px; margin-left: auto;
  background: var(--bg-tertiary, #20212e); color: var(--fg-muted, #787c99); white-space: nowrap;
}
.kflow__status--saved   { color: var(--status-success,#9ece6a); }
.kflow__status--updated { color: var(--status-info,#7dcfff); }
.kflow__excerpt {
  font-size: 12.5px; color: var(--fg-muted, #787c99); margin: 8px 0 0;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.kflow__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.kflow__tag {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--bg-tertiary, #20212e); color: var(--fg-muted, #787c99);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.kflow__jump {
  margin-top: 10px; display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; cursor: pointer; padding: 0;
  background: none; border: none; color: var(--accent-secondary, #bb9af7);
}
.kflow__jump:hover { text-decoration: underline; }
@media (max-width: 820px) {
  .kflow__cols { grid-template-columns: 1fr; }
  .kflow__arrow { transform: rotate(90deg); justify-self: center; }
}

/* ---- Coding persona (P5) ---- */
.persona { max-width: 640px; margin: 0 auto; padding: 40px 20px 60px; }
.persona__card {
  position: relative; text-align: center;
  padding: 36px 28px 28px; border-radius: 20px;
  background:
    radial-gradient(120% 120% at 50% -10%,
      color-mix(in srgb, var(--accent-secondary, #bb9af7) 16%, transparent) 0%, transparent 60%),
    var(--bg-secondary, #16161e);
  border: 1px solid var(--border-muted, #2a2b3c);
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

/* ---- P6: project digest (全景 Summary) ---- */
.digest { max-width: 820px; margin: 0 auto; padding: 32px 20px 64px; }
.digest__hero {
  text-align: center; padding: 28px 24px 30px; margin-bottom: 28px; border-radius: 18px;
  background:
    radial-gradient(120% 120% at 50% -10%,
      color-mix(in srgb, var(--accent-primary, #7aa2f7) 14%, transparent) 0%, transparent 62%),
    var(--bg-secondary, #16161e);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.digest__kicker {
  display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
  color: var(--accent-primary, #7aa2f7); letter-spacing: .08em; margin-bottom: 12px;
}
.digest__headline {
  font-size: clamp(20px, 3vw, 28px); font-weight: 800; line-height: 1.45;
  margin: 0 auto 18px; max-width: 32ch; color: var(--fg-primary, #c0caf5);
}
.digest__print {
  display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
  font-size: 12px; padding: 6px 14px; border-radius: 999px;
  background: var(--bg-tertiary, #20212e); color: var(--fg-secondary, #a9b1d6);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.digest__print:hover { border-color: var(--accent-primary, #7aa2f7); color: var(--fg-primary, #c0caf5); }
.digest__sec { margin-bottom: 28px; }
.digest__sec-title {
  display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 700;
  color: var(--fg-primary, #c0caf5); margin: 0 0 14px;
  padding-bottom: 8px; border-bottom: 1px solid var(--border-muted, #2a2b3c);
}
.digest__chapters { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.digest__chapter {
  padding: 14px 16px; border-radius: 12px;
  background: var(--bg-secondary, #16161e); border: 1px solid var(--border-muted, #2a2b3c);
  border-left: 3px solid color-mix(in srgb, var(--accent-primary, #7aa2f7) 60%, transparent);
}
.digest__chapter-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.digest__chapter-no {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%; font-size: 12px; font-weight: 700;
  color: var(--accent-primary, #7aa2f7);
  background: color-mix(in srgb, var(--accent-primary, #7aa2f7) 14%, transparent);
}
.digest__chapter-era { font-weight: 700; font-size: 14px; color: var(--fg-primary, #c0caf5); }
.digest__chapter-span {
  margin-left: auto; font-size: 11.5px; color: var(--fg-dim, #565f89);
  padding: 2px 9px; border-radius: 999px; background: var(--bg-tertiary, #20212e);
}
.digest__chapter-line { margin: 8px 0 0; font-size: 13.5px; line-height: 1.6; color: var(--fg-secondary, #a9b1d6); }
.digest__turns { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.digest__turn {
  display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 10px;
  background: var(--bg-secondary, #16161e); border: 1px solid var(--border-muted, #2a2b3c);
  border-left: 3px solid color-mix(in srgb, var(--accent-secondary, #bb9af7) 55%, transparent);
}
.digest__turn-title { font-weight: 700; font-size: 13px; color: var(--fg-primary, #c0caf5); }
.digest__turn-why { font-size: 13px; line-height: 1.55; color: var(--fg-secondary, #a9b1d6); }
.digest__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; }
.digest__kpi {
  text-align: center; padding: 16px 10px; border-radius: 12px;
  background: var(--bg-secondary, #16161e); border: 1px solid var(--border-muted, #2a2b3c);
}
.digest__kpi-num { font-size: 22px; font-weight: 800; color: var(--accent-primary, #7aa2f7); }
.digest__kpi-label { margin-top: 4px; font-size: 11.5px; color: var(--fg-dim, #565f89); }
.digest__learned { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.digest__learn {
  display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 1.5;
  color: var(--fg-secondary, #a9b1d6); padding: 9px 12px; border-radius: 8px;
  background: var(--bg-secondary, #16161e); border: 1px solid var(--border-muted, #2a2b3c);
}
.digest__next-head { display: flex; justify-content: flex-end; margin-bottom: 10px; }
.digest__copy {
  display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
  font-size: 12px; padding: 5px 12px; border-radius: 999px;
  background: var(--bg-tertiary, #20212e); color: var(--fg-secondary, #a9b1d6);
  border: 1px solid var(--border-muted, #2a2b3c);
}
.digest__copy:hover { border-color: var(--accent-primary, #7aa2f7); color: var(--fg-primary, #c0caf5); }
.digest__next { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.digest__next-item {
  display: flex; align-items: center; gap: 8px; font-size: 13.5px; line-height: 1.5;
  color: var(--fg-primary, #c0caf5); padding: 11px 14px; border-radius: 10px;
  background: color-mix(in srgb, var(--accent-primary, #7aa2f7) 8%, var(--bg-secondary, #16161e));
  border: 1px solid color-mix(in srgb, var(--accent-primary, #7aa2f7) 24%, transparent);
}
@media print {
  .evo-tabs, .evo-toolbar, .digest__print, .digest__copy, .evo-footer__keys { display: none !important; }
  .digest { max-width: none; }
}

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
    background: var(--bg-primary, #1a1b26); z-index: 20;
    border-bottom: 1px solid var(--border-muted, #2a2b3c);
  }
  .era { display: none; padding-bottom: 0; }
  .era::after { display: none; }
  .era.is-active { display: flex; margin-bottom: 0; }
  .era.is-active .era__scenes { display: none; }
}
`;
}
