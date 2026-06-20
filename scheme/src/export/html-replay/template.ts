/**
 * Session Replay HTML - 模板生成器
 * 将 CSS + JS + 数据组装为自包含 HTML
 */

import { getReplayStyles } from './styles';
import { getPlayerScript } from './player';
import { escapeHtml, escapeJsonForScript, formatTimestamp, formatDuration } from '../shared/html-utils';
import { themesToEmbeddableJson } from '../shared/theme-to-css';
import { themes } from '../../app/ui/themes/index';
import type { ReplaySessionData } from './types';

/** 生成完整的自包含 Replay HTML */
export function generateReplayHtml(data: ReplaySessionData): string {
  const css = getReplayStyles();
  const js = getPlayerScript();
  const jsonData = JSON.stringify(data);
  const themeData = themesToEmbeddableJson(themes);
  const titleText = data.title || 'Session Replay';
  const exportTime = formatTimestamp(data.exportedAt);
  const duration = formatDuration(data.stats.duration);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎬 ${escapeHtml(titleText)} — Session Replay</title>
  <style>${css}</style>
</head>
<body>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header__title" title="${escapeHtml(data.title)}">🎬 ${escapeHtml(titleText)}</div>
      <div class="header__meta">
        <span>📁 ${escapeHtml(data.projectDir)}</span>
        <span>⏱ ${duration}</span>
        <span>📅 ${exportTime}</span>
      </div>
      <div class="player">
        <button class="player__btn" id="prev-btn" title="Previous (←)">◀</button>
        <button class="player__btn" id="play-btn" title="Play/Pause (Space)">▶</button>
        <button class="player__btn" id="next-btn" title="Next (→)">▶▶</button>
        <button class="player__speed" id="speed-btn" title="Speed">1×</button>
        <div class="player__progress" id="progress">
          <div class="player__progress-fill" id="progress-fill"></div>
        </div>
        <span class="player__time" id="time-display">0:00 / 0:00</span>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main">
      <!-- Timeline (Left Panel) -->
      <aside class="timeline-panel">
        <div class="search">
          <span class="search__icon">🔍</span>
          <input class="search__input" id="search-input" type="text" placeholder="Search tools, files, content... (/)">
          <span class="search__count" id="search-count"></span>
        </div>
        <div class="timeline" id="timeline">
          <!-- Rendered by JS -->
        </div>
      </aside>

      <!-- Detail Panel (Right) -->
      <section class="detail" id="detail">
        <div class="detail__empty">← Select a node to view details</div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="stats">
        <div class="stats__item">
          <span class="stats__value" id="stats-tools">0</span>
          <span class="stats__label">tools</span>
        </div>
        <div class="stats__item">
          <span class="stats__value" id="stats-files">0</span>
          <span class="stats__label">files</span>
        </div>
        <div class="stats__item">
          <span class="stats__value" id="stats-errors">0</span>
          <span class="stats__label">errors</span>
        </div>
        <div class="stats__item">
          <span class="stats__value" id="stats-tokens">0</span>
          <span class="stats__label">tokens</span>
        </div>
        <div class="stats__item">
          <span class="stats__value" id="stats-cost">-</span>
          <span class="stats__label">cost</span>
        </div>
      </div>
      <div style="font-size:11px;color:var(--fg-dim)">
        GUI-Anything Session Replay v${data.version} · Press <kbd>?</kbd> for shortcuts
      </div>
    </footer>
  </div>

  <!-- Keyboard Shortcuts Overlay -->
  <div class="shortcuts" id="shortcuts">
    <div style="margin-bottom:8px;font-weight:600;color:var(--fg-secondary)">⌨ Keyboard Shortcuts</div>
    <table style="font-size:11px;line-height:2">
      <tr><td><kbd>Space</kbd></td><td style="padding-left:12px">Play / Pause</td></tr>
      <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td style="padding-left:12px">Previous / Next node</td></tr>
      <tr><td><kbd>j</kbd> <kbd>k</kbd></td><td style="padding-left:12px">Next / Previous exploration</td></tr>
      <tr><td><kbd>/</kbd></td><td style="padding-left:12px">Focus search</td></tr>
      <tr><td><kbd>Esc</kbd></td><td style="padding-left:12px">Close / Clear search</td></tr>
      <tr><td><kbd>?</kbd></td><td style="padding-left:12px">Toggle this help</td></tr>
    </table>
  </div>

  <!-- Theme Selector (top-right) -->
  <div class="theme-selector" id="theme-selector">
    <select id="theme-select" title="Switch theme">
      ${Object.keys(themes).map(name => 
        `<option value="${name}"${name === (data.theme || 'tokyo-night') ? ' selected' : ''}>${name}</option>`
      ).join('\n      ')}
    </select>
  </div>

  <!-- Embedded Data (self-contained) -->
  <script type="application/json" id="replay-data">${escapeJsonForScript(jsonData)}</script>
  <script type="application/json" id="theme-data">${escapeJsonForScript(themeData)}</script>

  <!-- Player Script -->
  <script>${js}</script>
</body>
</html>`;
}