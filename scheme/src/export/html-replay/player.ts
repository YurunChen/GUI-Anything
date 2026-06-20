/**
 * Session Replay HTML - 前端播放器 JS
 * Vanilla JS，嵌入到 HTML 中
 */

export function getPlayerScript(): string {
  return `
(function() {
  'use strict';

  // ═══════════════════════════════════════
  // State
  // ═══════════════════════════════════════

  const data = JSON.parse(document.getElementById('replay-data').textContent);
  let state = {
    playing: false,
    speed: 1,
    currentNodeIndex: -1,
    currentExpIndex: 0,
    allNodes: [],        // flat list of all nodes with exploration context
    searchQuery: '',
    filteredNodes: null,  // null = no filter
    expandedExps: new Set(),
  };

  // Build flat node list for playback
  data.explorations.forEach((exp, ei) => {
    exp.nodes.forEach((node, ni) => {
      state.allNodes.push({ ...node, expIndex: ei, nodeIndex: ni, expId: exp.id });
    });
    // Expand first exploration by default
    if (ei === 0) state.expandedExps.add(exp.id);
  });

  // ═══════════════════════════════════════
  // DOM References
  // ═══════════════════════════════════════

  const $timeline = document.getElementById('timeline');
  const $detail = document.getElementById('detail');
  const $playBtn = document.getElementById('play-btn');
  const $prevBtn = document.getElementById('prev-btn');
  const $nextBtn = document.getElementById('next-btn');
  const $speedBtn = document.getElementById('speed-btn');
  const $progress = document.getElementById('progress');
  const $progressFill = document.getElementById('progress-fill');
  const $timeDisplay = document.getElementById('time-display');
  const $searchInput = document.getElementById('search-input');
  const $searchCount = document.getElementById('search-count');
  const $shortcuts = document.getElementById('shortcuts');

  // ═══════════════════════════════════════
  // Render Timeline
  // ═══════════════════════════════════════

  function getNodeIcon(type) {
    switch(type) {
      case 'tool': return '⚙';
      case 'response': return '💬';
      case 'thinking': return '🧠';
      case 'error': return '❌';
      case 'result': return '📋';
      default: return '•';
    }
  }

  function getStatusBadge(exp) {
    let badges = '';
    if (exp.phaseSeen.explore) badges += '<span class="badge badge--explore">explore</span>';
    if (exp.phaseSeen.execute) badges += '<span class="badge badge--execute">execute</span>';
    if (exp.phaseSeen.verify) badges += '<span class="badge badge--verify">verify</span>';
    const totalErrors = exp.errorCounts.tool + exp.errorCounts.system + exp.errorCounts.result;
    if (totalErrors > 0) badges += '<span class="badge badge--error">' + totalErrors + ' err</span>';
    if (exp.status === 'complete') badges += '<span class="badge badge--complete">✓</span>';
    if (exp.status === 'running') badges += '<span class="badge badge--running">⟳</span>';
    return badges;
  }

  function isNodeVisible(node) {
    if (!state.searchQuery) return true;
    const q = state.searchQuery.toLowerCase();
    return node.label.toLowerCase().includes(q) ||
           (node.detail && node.detail.toLowerCase().includes(q)) ||
           (node.toolName && node.toolName.toLowerCase().includes(q)) ||
           (node.filePath && node.filePath.toLowerCase().includes(q));
  }

  function renderTimeline() {
    let html = '';
    let visibleCount = 0;

    data.explorations.forEach((exp, ei) => {
      const isExpanded = state.expandedExps.has(exp.id);
      const isActiveExp = state.currentNodeIndex >= 0 &&
        state.allNodes[state.currentNodeIndex]?.expIndex === ei;
      const toggleClass = isExpanded ? 'exploration__toggle--open' : '';
      const headerClass = isActiveExp ? 'exploration__header--active' : '';

      html += '<div class="exploration">';
      html += '<div class="exploration__header ' + headerClass + '" data-exp-id="' + exp.id + '" data-exp-index="' + ei + '">';
      html += '<span class="exploration__toggle ' + toggleClass + '">▶</span>';
      html += '<div>';
      html += '<div class="exploration__question">' + escapeHtml(exp.question.slice(0, 120)) + '</div>';
      html += '<div class="exploration__badges">' + getStatusBadge(exp) + '</div>';
      html += '</div>';
      html += '</div>';

      if (isExpanded) {
        html += '<div class="exploration__nodes">';
        exp.nodes.forEach((node, ni) => {
          if (!isNodeVisible(node)) return;
          visibleCount++;
          const flatIdx = state.allNodes.findIndex(n => n.id === node.id);
          const isActive = flatIdx === state.currentNodeIndex;
          const activeClass = isActive ? 'node--active' : '';
          const typeClass = 'node--' + node.type;

          html += '<div class="node ' + typeClass + ' ' + activeClass + '" data-flat-index="' + flatIdx + '">';
          html += '<span class="node__icon">' + getNodeIcon(node.type) + '</span>';
          html += '<span class="node__label">' + escapeHtml(node.label.slice(0, 80)) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div>';
    });

    $timeline.innerHTML = html;

    // Update search count
    if (state.searchQuery) {
      const total = state.allNodes.filter(n => isNodeVisible(n)).length;
      $searchCount.textContent = total + ' results';
    } else {
      $searchCount.textContent = '';
    }

    // Scroll active node into view
    const activeEl = $timeline.querySelector('.node--active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ═══════════════════════════════════════
  // Render Detail Panel
  // ═══════════════════════════════════════

  function renderDetail() {
    if (state.currentNodeIndex < 0 || state.currentNodeIndex >= state.allNodes.length) {
      $detail.innerHTML = '<div class="detail__empty">← Select a node to view details</div>';
      return;
    }

    const node = state.allNodes[state.currentNodeIndex];
    const exp = data.explorations[node.expIndex];
    const time = new Date(node.timestamp).toLocaleTimeString();

    let metaHtml = '<span>⏰ ' + time + '</span>';
    if (node.phase) metaHtml += '<span>📍 ' + node.phase + '</span>';
    if (node.toolName) metaHtml += '<span>🔧 ' + node.toolName + '</span>';
    if (node.filePath) metaHtml += '<span>📁 ' + node.filePath + '</span>';
    if (node.status === 'error') metaHtml += '<span style="color:var(--status-error)">❌ error</span>';

    let contentHtml = '';
    if (node.detail) {
      contentHtml = '<div class="detail__content">' + escapeHtml(node.detail) + '</div>';
    } else {
      contentHtml = '<div class="detail__content" style="color:var(--fg-muted);font-style:italic">No detail content for this node.</div>';
    }

    $detail.innerHTML =
      '<div class="detail__header">' +
        '<div class="detail__type">' + node.type + (node.status ? ' · ' + node.status : '') + '</div>' +
        '<div class="detail__title">' + escapeHtml(node.label) + '</div>' +
        '<div class="detail__meta">' + metaHtml + '</div>' +
      '</div>' +
      contentHtml;
  }

  // ═══════════════════════════════════════
  // Playback Engine
  // ═══════════════════════════════════════

  let playTimer = null;

  function getPlayInterval() {
    // Base interval: 800ms per node, adjusted by speed
    return 800 / state.speed;
  }

  function play() {
    state.playing = true;
    $playBtn.classList.add('player__btn--active');
    $playBtn.textContent = '⏸';
    scheduleNext();
  }

  function pause() {
    state.playing = false;
    $playBtn.classList.remove('player__btn--active');
    $playBtn.textContent = '▶';
    if (playTimer) {
      clearTimeout(playTimer);
      playTimer = null;
    }
  }

  function scheduleNext() {
    if (!state.playing) return;
    playTimer = setTimeout(() => {
      if (state.currentNodeIndex < state.allNodes.length - 1) {
        goToNode(state.currentNodeIndex + 1);
        scheduleNext();
      } else {
        pause(); // Reached end
      }
    }, getPlayInterval());
  }

  function goToNode(index) {
    if (index < 0) index = 0;
    if (index >= state.allNodes.length) index = state.allNodes.length - 1;
    state.currentNodeIndex = index;

    // Auto-expand the exploration containing this node
    const node = state.allNodes[index];
    if (node) {
      state.expandedExps.add(node.expId);
    }

    updateProgress();
    renderTimeline();
    renderDetail();
  }

  function updateProgress() {
    const pct = state.allNodes.length > 0
      ? ((state.currentNodeIndex + 1) / state.allNodes.length) * 100
      : 0;
    $progressFill.style.width = pct + '%';

    // Time display
    if (state.currentNodeIndex >= 0 && state.allNodes.length > 0) {
      const currentNode = state.allNodes[state.currentNodeIndex];
      const firstTs = state.allNodes[0].timestamp;
      const elapsed = currentNode.timestamp - firstTs;
      const total = state.allNodes[state.allNodes.length - 1].timestamp - firstTs;
      $timeDisplay.textContent = formatMs(elapsed) + ' / ' + formatMs(total);
    } else {
      $timeDisplay.textContent = '0:00 / ' + formatMs(data.stats.duration);
    }
  }

  // ═══════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════

  // Play/Pause
  $playBtn.addEventListener('click', () => {
    if (state.playing) pause();
    else play();
  });

  // Prev/Next
  $prevBtn.addEventListener('click', () => {
    pause();
    goToNode(state.currentNodeIndex - 1);
  });

  $nextBtn.addEventListener('click', () => {
    pause();
    goToNode(state.currentNodeIndex + 1);
  });

  // Speed
  const speeds = [1, 2, 4, 8];
  $speedBtn.addEventListener('click', () => {
    const idx = speeds.indexOf(state.speed);
    state.speed = speeds[(idx + 1) % speeds.length];
    $speedBtn.textContent = state.speed + '×';
  });

  // Progress bar click
  $progress.addEventListener('click', (e) => {
    const rect = $progress.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const targetIdx = Math.floor(pct * state.allNodes.length);
    pause();
    goToNode(targetIdx);
  });

  // Timeline clicks (delegation)
  $timeline.addEventListener('click', (e) => {
    // Node click
    const nodeEl = e.target.closest('.node');
    if (nodeEl) {
      const idx = parseInt(nodeEl.dataset.flatIndex, 10);
      if (!isNaN(idx)) {
        pause();
        goToNode(idx);
      }
      return;
    }

    // Exploration header click (toggle expand)
    const expHeader = e.target.closest('.exploration__header');
    if (expHeader) {
      const expId = expHeader.dataset.expId;
      if (state.expandedExps.has(expId)) {
        state.expandedExps.delete(expId);
      } else {
        state.expandedExps.add(expId);
      }
      renderTimeline();
    }
  });

  // Search
  $searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    // Expand all explorations when searching
    if (state.searchQuery) {
      data.explorations.forEach(exp => state.expandedExps.add(exp.id));
    }
    renderTimeline();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't capture when typing in search
    if (e.target === $searchInput) {
      if (e.key === 'Escape') {
        $searchInput.blur();
        $searchInput.value = '';
        state.searchQuery = '';
        renderTimeline();
      }
      return;
    }

    switch(e.key) {
      case ' ':
        e.preventDefault();
        if (state.playing) pause(); else play();
        break;
      case 'ArrowRight':
        e.preventDefault();
        pause();
        goToNode(state.currentNodeIndex + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        pause();
        goToNode(state.currentNodeIndex - 1);
        break;
      case 'j':
        // Next exploration
        e.preventDefault();
        pause();
        const nextExpIdx = findNextExplorationStart(state.currentNodeIndex);
        if (nextExpIdx >= 0) goToNode(nextExpIdx);
        break;
      case 'k':
        // Previous exploration
        e.preventDefault();
        pause();
        const prevExpIdx = findPrevExplorationStart(state.currentNodeIndex);
        if (prevExpIdx >= 0) goToNode(prevExpIdx);
        break;
      case '/':
        e.preventDefault();
        $searchInput.focus();
        break;
      case '?':
        $shortcuts.classList.toggle('shortcuts--visible');
        break;
      case 'Escape':
        $shortcuts.classList.remove('shortcuts--visible');
        break;
    }
  });

  // ═══════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════

  function findNextExplorationStart(currentIdx) {
    if (currentIdx < 0) return state.allNodes.length > 0 ? 0 : -1;
    const currentExpIdx = state.allNodes[currentIdx]?.expIndex;
    for (let i = currentIdx + 1; i < state.allNodes.length; i++) {
      if (state.allNodes[i].expIndex !== currentExpIdx) return i;
    }
    return -1;
  }

  function findPrevExplorationStart(currentIdx) {
    if (currentIdx <= 0) return -1;
    const currentExpIdx = state.allNodes[currentIdx]?.expIndex;
    // Go back to start of current exploration
    let startOfCurrent = currentIdx;
    while (startOfCurrent > 0 && state.allNodes[startOfCurrent - 1].expIndex === currentExpIdx) {
      startOfCurrent--;
    }
    // If we're already at start, go to previous exploration
    if (startOfCurrent === currentIdx && startOfCurrent > 0) {
      return startOfCurrent - 1;
    }
    return startOfCurrent;
  }

  function formatMs(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════
  // Stats Footer
  // ═══════════════════════════════════════

  function renderStats() {
    const s = data.stats;
    document.getElementById('stats-tools').textContent = s.totalTools;
    document.getElementById('stats-files').textContent = s.filesAccessed.length;
    document.getElementById('stats-errors').textContent = s.totalErrors;
    document.getElementById('stats-tokens').textContent = formatTokens(s.inputTokens + s.outputTokens);
    document.getElementById('stats-cost').textContent = s.costUsd > 0 ? '$' + s.costUsd.toFixed(3) : '-';
  }

  function formatTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  // ═══════════════════════════════════════
  // Theme Switcher
  // ═══════════════════════════════════════

  const $themeSelect = document.getElementById('theme-select');
  const themeDataEl = document.getElementById('theme-data');
  let themeMap = {};

  if (themeDataEl) {
    try { themeMap = JSON.parse(themeDataEl.textContent); } catch(e) {}
  }

  function applyTheme(name) {
    const vars = themeMap[name];
    if (!vars) return;
    // Parse CSS variable declarations and apply to :root
    const lines = vars.split(';').filter(l => l.trim());
    lines.forEach(line => {
      const match = line.match(/--([\w-]+)\s*:\s*(.+)/);
      if (match) {
        document.documentElement.style.setProperty('--' + match[1], match[2].trim());
      }
    });
  }

  if ($themeSelect) {
    $themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }

  // ═══════════════════════════════════════
  // Init
  // ═══════════════════════════════════════

  // Apply the embedded/selected theme so colors match the dropdown on load
  applyTheme(($themeSelect && $themeSelect.value) || data.theme || 'tokyo-night');

  renderTimeline();
  renderDetail();
  renderStats();
  updateProgress();

  // Auto-select first node
  if (state.allNodes.length > 0) {
    goToNode(0);
  }

})();
`;
}