/**
 * Session Replay HTML - CSS 样式
 * Tokyo Night 默认主题 + CSS Variables 支持多主题切换
 */

export function getReplayStyles(): string {
  return `
/* ═══════════════════════════════════════════════════════════
   Session Replay - Styles
   Tokyo Night Default Theme with CSS Custom Properties
   ═══════════════════════════════════════════════════════════ */

:root {
  --bg-primary: #1a1b26;
  --bg-secondary: #24283b;
  --bg-tertiary: #1f2335;
  --bg-highlight: #3d4259;
  --fg-primary: #c0caf5;
  --fg-secondary: #a9b1d6;
  --fg-muted: #565f89;
  --fg-dim: #3b4261;
  --status-success: #9ece6a;
  --status-warning: #e0af68;
  --status-error: #f7768e;
  --status-info: #7aa2f7;
  --accent-primary: #7aa2f7;
  --accent-secondary: #bb9af7;
  --accent-tertiary: #7dcfff;
  --border-normal: #3d4259;
  --border-active: #7aa2f7;
  --border-muted: #2f3449;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --radius: 8px;
  --radius-sm: 4px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--fg-primary);
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
}

/* ─── Layout ─── */

.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  overflow: hidden;
}

.header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-normal);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.header__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.header__meta {
  font-size: 12px;
  color: var(--fg-muted);
  display: flex;
  gap: 12px;
  align-items: center;
}

.header__meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.main {
  display: grid;
  grid-template-columns: 340px 1fr;
  overflow: hidden;
}

.footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-normal);
  padding: 8px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--fg-muted);
}

/* ─── Player Controls ─── */

.player {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.player__btn {
  background: var(--bg-highlight);
  border: 1px solid var(--border-normal);
  color: var(--fg-primary);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s ease;
}

.player__btn:hover {
  background: var(--bg-highlight);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.player__btn--active {
  background: var(--accent-primary);
  color: var(--bg-primary);
  border-color: var(--accent-primary);
}

.player__speed {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-normal);
  color: var(--fg-secondary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-mono);
  cursor: pointer;
  min-width: 40px;
  text-align: center;
}

.player__speed:hover {
  border-color: var(--accent-primary);
}

.player__progress {
  flex: 1;
  max-width: 200px;
  height: 4px;
  background: var(--bg-highlight);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.player__progress-fill {
  height: 100%;
  background: var(--accent-primary);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.player__time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-muted);
  min-width: 90px;
  text-align: center;
}

/* ─── Timeline (Left Panel) ─── */

.timeline-panel {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-normal);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.timeline::-webkit-scrollbar {
  width: 6px;
}

.timeline::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.timeline::-webkit-scrollbar-thumb {
  background: var(--bg-highlight);
  border-radius: 3px;
}

.exploration {
  margin-bottom: 4px;
}

.exploration__header {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  transition: background 0.15s ease;
}

.exploration__header:hover {
  background: var(--bg-highlight);
}

.exploration__header--active {
  background: var(--bg-highlight);
  border-left: 3px solid var(--accent-primary);
}

.exploration__toggle {
  color: var(--fg-muted);
  font-size: 10px;
  margin-top: 3px;
  transition: transform 0.2s ease;
}

.exploration__toggle--open {
  transform: rotate(90deg);
}

.exploration__question {
  font-size: 13px;
  color: var(--fg-primary);
  font-weight: 500;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.exploration__badges {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.badge--explore { background: color-mix(in srgb, var(--status-info) 15%, transparent); color: var(--status-info); }
.badge--execute { background: color-mix(in srgb, var(--status-success) 15%, transparent); color: var(--status-success); }
.badge--verify { background: color-mix(in srgb, var(--status-warning) 15%, transparent); color: var(--status-warning); }
.badge--error { background: color-mix(in srgb, var(--status-error) 15%, transparent); color: var(--status-error); }
.badge--complete { background: color-mix(in srgb, var(--status-success) 15%, transparent); color: var(--status-success); }
.badge--running { background: color-mix(in srgb, var(--status-info) 15%, transparent); color: var(--status-info); }

.exploration__nodes {
  margin-left: 20px;
  border-left: 1px solid var(--border-muted);
  padding-left: 8px;
  margin-top: 4px;
}

.node {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.1s ease;
  margin-bottom: 1px;
}

.node:hover {
  background: var(--bg-highlight);
}

.node--active {
  background: var(--bg-highlight);
  border-left: 2px solid var(--accent-secondary);
}

.node__icon {
  font-size: 11px;
  flex-shrink: 0;
}

.node__label {
  color: var(--fg-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node--tool .node__icon { color: var(--accent-tertiary); }
.node--response .node__icon { color: var(--accent-secondary); }
.node--thinking .node__icon { color: var(--fg-muted); }
.node--error .node__icon { color: var(--status-error); }
.node--error .node__label { color: var(--status-error); }

/* ─── Detail Panel (Right) ─── */

.detail {
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-primary);
}

.detail::-webkit-scrollbar {
  width: 6px;
}

.detail::-webkit-scrollbar-thumb {
  background: var(--bg-highlight);
  border-radius: 3px;
}

.detail__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--fg-muted);
  font-size: 14px;
}

.detail__header {
  margin-bottom: 16px;
}

.detail__type {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-muted);
  margin-bottom: 4px;
}

.detail__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-primary);
  word-break: break-word;
}

.detail__meta {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--fg-muted);
}

.detail__content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-normal);
  border-radius: var(--radius);
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--fg-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
}

/* ─── Search ─── */

.search {
  position: relative;
  margin: 8px 8px 4px;
}

.search__input {
  width: 100%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-normal);
  color: var(--fg-primary);
  padding: 6px 10px 6px 28px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}

.search__input:focus {
  border-color: var(--accent-primary);
}

.search__icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fg-muted);
  font-size: 12px;
}

.search__count {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fg-muted);
  font-size: 10px;
}

/* ─── Stats Bar ─── */

.stats {
  display: flex;
  gap: 16px;
  align-items: center;
}

.stats__item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stats__value {
  color: var(--fg-secondary);
  font-family: var(--font-mono);
  font-weight: 500;
}

.stats__label {
  color: var(--fg-muted);
}

/* ─── Responsive ─── */

@media (max-width: 768px) {
  .main {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .timeline {
    border-right: none;
    border-bottom: 1px solid var(--border-normal);
  }

  .header {
    flex-wrap: wrap;
    padding: 8px 12px;
  }

  .player__progress {
    max-width: 120px;
  }
}

/* ─── Animations ─── */

@keyframes nodeEnter {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

.node--entering {
  animation: nodeEnter 0.2s ease;
}

/* ─── Keyboard shortcut hint ─── */

.shortcuts {
  position: fixed;
  bottom: 40px;
  right: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-normal);
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 11px;
  color: var(--fg-muted);
  display: none;
  z-index: 100;
}

.shortcuts--visible {
  display: block;
}

.shortcuts kbd {
  background: var(--bg-highlight);
  border: 1px solid var(--border-normal);
  border-radius: 3px;
  padding: 1px 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-secondary);
}

/* ─── Theme Selector ─── */

.theme-selector {
  position: fixed;
  top: 12px;
  right: 20px;
  z-index: 200;
}

.theme-selector select {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-normal);
  color: var(--fg-secondary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: var(--font-mono);
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease;
}

.theme-selector select:hover,
.theme-selector select:focus {
  border-color: var(--accent-primary);
}
`;
}