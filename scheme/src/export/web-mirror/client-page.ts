/**
 * Web Mirror - 客户端 HTML 页面
 * 实时展示 Flow session 进度
 */

export function getWebMirrorClientPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🌐 Flow Web Mirror</title>
  <style>
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
  --radius: 8px;
  --radius-sm: 4px;
  --font-mono: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  height: 100%;
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--fg-primary);
  font-size: 14px;
  line-height: 1.5;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* ─── Header ─── */
.header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-normal);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.header__title { font-size: 16px; font-weight: 600; }
.header__status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-left: auto;
}

.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--status-error);
}
.status-dot--connected { background: var(--status-success); }
.status-dot--reconnecting { background: var(--status-warning); animation: pulse 1s infinite; }

@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* ─── Phase Indicator ─── */
.phase-bar {
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-normal);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.phase-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fg-muted);
  opacity: 0.5;
  transition: all 0.3s ease;
}
.phase-item--active { color: var(--accent-primary); opacity: 1; font-weight: 600; }
.phase-item--seen { opacity: 0.8; color: var(--fg-secondary); }

.phase-icon { font-size: 16px; }

/* ─── Stats ─── */
.stats-bar {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-normal);
  padding: 8px 16px;
  display: flex;
  gap: 20px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.stat__value { font-family: var(--font-mono); font-weight: 600; color: var(--fg-primary); }
.stat__label { color: var(--fg-muted); }

/* ─── Timeline ─── */
.timeline {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.exploration {
  margin-bottom: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-normal);
  border-radius: var(--radius);
  overflow: hidden;
}

.exploration--running { border-color: var(--accent-primary); }

.exploration__header {
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-normal);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.exploration__status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  margin-left: auto;
}
.exploration__status--running { background: rgba(122,162,247,0.15); color: var(--status-info); }
.exploration__status--complete { background: rgba(158,206,106,0.15); color: var(--status-success); }

.exploration__nodes {
  padding: 6px 10px;
  max-height: 300px;
  overflow-y: auto;
}

.node {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }

.node__icon { font-size: 11px; flex-shrink: 0; }
.node__label { color: var(--fg-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.node--tool .node__icon { color: var(--accent-tertiary); }
.node--response .node__icon { color: var(--accent-secondary); }
.node--error .node__icon { color: var(--status-error); }
.node--error .node__label { color: var(--status-error); }

/* ─── Empty / Loading ─── */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--fg-muted);
  gap: 8px;
}
.empty__icon { font-size: 48px; opacity: 0.5; }
.empty__text { font-size: 14px; }

/* ─── Mobile optimizations ─── */
@media (max-width: 600px) {
  .stats-bar { gap: 12px; }
  .exploration__nodes { max-height: 200px; }
}
  </style>
</head>
<body>
  <div class="app">
    <header class="header">
      <span class="header__title">🌐 Flow Web Mirror</span>
      <div class="header__status">
        <span class="status-dot" id="status-dot"></span>
        <span id="status-text">Connecting...</span>
      </div>
    </header>

    <div class="phase-bar" id="phase-bar">
      <div class="phase-item" id="phase-explore"><span class="phase-icon">🔍</span> Explore</div>
      <div class="phase-item" id="phase-execute"><span class="phase-icon">⚡</span> Execute</div>
      <div class="phase-item" id="phase-verify"><span class="phase-icon">✅</span> Verify</div>
    </div>

    <div class="stats-bar" id="stats-bar">
      <div class="stat"><span class="stat__value" id="stat-tools">0</span><span class="stat__label">tools</span></div>
      <div class="stat"><span class="stat__value" id="stat-errors">0</span><span class="stat__label">errors</span></div>
      <div class="stat"><span class="stat__value" id="stat-explorations">0</span><span class="stat__label">turns</span></div>
      <div class="stat"><span class="stat__value" id="stat-tokens">0</span><span class="stat__label">tokens</span></div>
      <div class="stat"><span class="stat__value" id="stat-cost">-</span><span class="stat__label">cost</span></div>
      <div class="stat"><span class="stat__value" id="stat-uptime">0:00</span><span class="stat__label">uptime</span></div>
    </div>

    <div class="timeline" id="timeline">
      <div class="empty">
        <div class="empty__icon">🌊</div>
        <div class="empty__text">Waiting for session data...</div>
      </div>
    </div>
  </div>

  <script>
(function() {
  'use strict';

  let state = { explorations: [], stats: null, currentPhase: 'idle', isRunning: false };
  let ws = null;
  let reconnectTimer = null;

  const $timeline = document.getElementById('timeline');
  const $statusDot = document.getElementById('status-dot');
  const $statusText = document.getElementById('status-text');

  // ─── WebSocket Connection ───
  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host + '/ws');

    ws.onopen = () => {
      setStatus('connected');
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch(e) {}
    };

    ws.onclose = () => {
      setStatus('reconnecting');
      reconnectTimer = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function setStatus(s) {
    $statusDot.className = 'status-dot' + (s === 'connected' ? ' status-dot--connected' : s === 'reconnecting' ? ' status-dot--reconnecting' : '');
    $statusText.textContent = s === 'connected' ? 'Connected' : s === 'reconnecting' ? 'Reconnecting...' : 'Disconnected';
  }

  // ─── Message Handlers ───
  function handleMessage(msg) {
    switch(msg.type) {
      case 'snapshot':
        state = msg.data;
        renderAll();
        break;
      case 'node_added':
        addNode(msg.explorationId, msg.node);
        break;
      case 'exploration_start':
        state.explorations.push(msg.exploration);
        renderTimeline();
        break;
      case 'phase_change':
        state.currentPhase = msg.phase;
        updatePhaseBar();
        break;
      case 'stats_update':
        state.stats = msg.stats;
        renderStats();
        break;
      case 'session_complete':
        state.isRunning = false;
        renderAll();
        break;
    }
  }

  function addNode(expId, node) {
    const exp = state.explorations.find(e => e.id === expId);
    if (exp) {
      exp.nodes.push(node);
      renderTimeline();
      // Auto-scroll to bottom
      $timeline.scrollTop = $timeline.scrollHeight;
    }
  }

  // ─── Rendering ───
  function renderAll() {
    renderTimeline();
    renderStats();
    updatePhaseBar();
  }

  function getNodeIcon(type) {
    switch(type) {
      case 'tool': return '⚙';
      case 'response': return '💬';
      case 'thinking': return '🧠';
      case 'error': return '❌';
      default: return '•';
    }
  }

  function renderTimeline() {
    if (!state.explorations || state.explorations.length === 0) {
      $timeline.innerHTML = '<div class="empty"><div class="empty__icon">🌊</div><div class="empty__text">Waiting for session data...</div></div>';
      return;
    }

    let html = '';
    // Show last 10 explorations max
    const exps = state.explorations.slice(-10);
    exps.forEach(exp => {
      const isRunning = exp.status === 'running';
      const statusClass = isRunning ? 'exploration__status--running' : 'exploration__status--complete';
      const cardClass = isRunning ? 'exploration--running' : '';

      html += '<div class="exploration ' + cardClass + '">';
      html += '<div class="exploration__header">';
      html += '<span>' + escapeHtml(exp.question.slice(0, 80)) + '</span>';
      html += '<span class="exploration__status ' + statusClass + '">' + (isRunning ? '⟳ running' : '✓ done') + '</span>';
      html += '</div>';
      html += '<div class="exploration__nodes">';

      // Show last 20 nodes
      const nodes = exp.nodes.slice(-20);
      nodes.forEach(node => {
        const typeClass = 'node--' + node.type;
        html += '<div class="node ' + typeClass + '">';
        html += '<span class="node__icon">' + getNodeIcon(node.type) + '</span>';
        html += '<span class="node__label">' + escapeHtml(node.label.slice(0, 80)) + '</span>';
        html += '</div>';
      });

      if (exp.nodes.length > 20) {
        html += '<div class="node" style="color:var(--fg-muted);font-style:italic">... ' + (exp.nodes.length - 20) + ' more nodes above</div>';
      }

      html += '</div></div>';
    });

    $timeline.innerHTML = html;
    $timeline.scrollTop = $timeline.scrollHeight;
  }

  function renderStats() {
    if (!state.stats) return;
    const s = state.stats;
    document.getElementById('stat-tools').textContent = s.totalTools;
    document.getElementById('stat-errors').textContent = s.totalErrors;
    document.getElementById('stat-explorations').textContent = s.totalExplorations;
    document.getElementById('stat-tokens').textContent = formatTokens(s.inputTokens + s.outputTokens);
    document.getElementById('stat-cost').textContent = s.costUsd > 0 ? '$' + s.costUsd.toFixed(3) : '-';
    document.getElementById('stat-uptime').textContent = formatMs(s.uptimeMs);
  }

  function updatePhaseBar() {
    const phases = ['explore', 'execute', 'verify'];
    const currentExp = state.explorations[state.explorations.length - 1];
    phases.forEach(p => {
      const el = document.getElementById('phase-' + p);
      el.className = 'phase-item';
      if (state.currentPhase === p) {
        el.className += ' phase-item--active';
      } else if (currentExp && currentExp.phaseSeen && currentExp.phaseSeen[p]) {
        el.className += ' phase-item--seen';
      }
    });
  }

  // ─── Helpers ───
  function formatTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatMs(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    if (min >= 60) {
      const h = Math.floor(min / 60);
      return h + 'h ' + (min % 60) + 'm';
    }
    return min + ':' + (s < 10 ? '0' : '') + s;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Init ───
  connect();

  // Keepalive ping
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send('ping');
    }
  }, 30000);

})();
  </script>
</body>
</html>`;
}