# RFC: Session Replay HTML — 单文件可分享的 Flow 回放

> ⚠️ **SUPERSEDED（2026-06-20）**：CLI 对话回放已被「项目功能演进史」取代。
> `--export-html` 现产出 intent 演进可视化（`scheme/src/export/evolution/`），旧 `export/html-replay/` 已删除。
> 设计见计划书 `purring-dancing-tide.md`。本文档仅留作历史参考。

> **Status**: Superseded  
> **Author**: S-Coder  
> **Date**: 2026-05-21  
> **Scope**: `scheme/src/export/` (新目录)

---

## 1. 动机与目标

### 问题
- TUI Observer 是实时体验，**事后无法回看**
- 跑完一个 45 分钟的 session 后，只有原始 JSONL（数千行 JSON）
- 想分享给同事看 "Claude 是怎么一步步解决这个问题的"，没有好的载体
- Posthoc 模式只能在本机跑，无法脱离环境传递

### 目标
生成**单个自包含 HTML 文件**，具备：

| 能力 | 说明 |
|------|------|
| 📺 时间线回放 | 按时间顺序播放每个 exploration node |
| ⏯️ 播放控制 | Play / Pause / 速度调节 / 跳转到指定 exploration |
| 🔍 全文搜索 | 搜索 tool name、file path、response 文本 |
| 📊 统计面板 | Token 消耗、工具调用分布、Phase 时间占比 |
| 🎨 主题 | 复用现有主题系统（嵌入 CSS variables） |
| 📦 零依赖 | 单 HTML 文件，双击打开，无需网络 / 无需安装 |
| 📱 响应式 | 适配桌面和移动端（手机上也能看） |

### 非目标（v1 不做）
- 实时流式（那是 Web Mirror 的事）
- 编辑 / 注释功能
- 多 session 对比

---

## 2. 架构设计

### 2.1 整体流程

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  ~/.claude/projects/ │     │  export-html.ts       │     │  replay.html    │
│  session.jsonl       │────▶│  (Bun script)         │────▶│  (self-contained)│
│                      │     │                        │     │                  │
│  Raw JSONL events    │     │  1. Parse JSONL        │     │  <script>        │
│                      │     │  2. Extract structure  │     │    sessionData   │
│                      │     │  3. Build HTML+CSS+JS  │     │  </script>       │
│                      │     │  4. Inline everything  │     │  <style>         │
│                      │     │  5. Write single file  │     │    theme CSS     │
└─────────────────────┘     └──────────────────────┘     │  </style>        │
                                                          │  <div id="app">  │
                                                          │  </div>          │
                                                          └─────────────────┘
```

### 2.2 数据模型（嵌入 HTML 的 JSON）

```typescript
// 嵌入到 <script id="session-data" type="application/json"> 中
interface ReplaySessionData {
  meta: {
    sessionId: string;
    prompt: string;            // 首个用户问题
    startedAt: number;         // timestamp ms
    endedAt: number;
    durationMs: number;
    model: string;             // 运行时模型
    projectDir: string;        // 项目目录（脱敏后）
    generatedAt: string;       // HTML 生成时间
    generatorVersion: string;  // "flow-replay/0.1.0"
  };
  stats: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd: number;
    turns: number;
    totalToolCalls: number;
    totalErrors: number;
  };
  explorations: ReplayExploration[];
  fileAccess: Record<string, number>;  // filename → access count
  theme: string;                        // 用户当前主题名
}

interface ReplayExploration {
  id: string;
  question: string;
  startedAt: number;
  endedAt?: number;
  status: 'complete' | 'running' | 'interrupted';
  summary?: string;          // AI 生成的摘要（如果有 cache）
  currentPhase: 'explore' | 'execute' | 'verify' | 'idle';
  phaseSeen: { explore: boolean; execute: boolean; verify: boolean };
  errorCounts: { tool: number; system: number; result: number };
  nodes: ReplayNode[];
}

interface ReplayNode {
  id: string;
  timestamp: number;
  type: 'tool' | 'result' | 'response' | 'thinking' | 'error';
  label: string;            // 一行摘要
  detail?: string;          // 展开后的完整内容（可能是代码、diff 等）
  status?: 'running' | 'ok' | 'error';
  phase?: 'explore' | 'execute' | 'verify';
  toolName?: string;        // 工具名（如果 type=tool）
  filePath?: string;        // 涉及的文件（如果有）
}
```

### 2.3 文件结构（新增）

```
scheme/src/export/
├── html-replay/
│   ├── export-html.ts          # 主导出逻辑
│   ├── template.ts             # HTML 模板字符串（带占位符）
│   ├── styles.ts               # CSS 字符串（含主题变量）
│   ├── player.ts               # 前端 JS 逻辑（vanilla）
│   ├── components/             # 前端 UI 组件（纯字符串模板）
│   │   ├── timeline.ts         # 时间线组件
│   │   ├── detail-panel.ts     # 详情面板
│   │   ├── stats-panel.ts      # 统计面板
│   │   ├── search.ts           # 搜索组件
│   │   └── player-controls.ts  # 播放控制条
│   └── theme-to-css.ts         # 主题转 CSS 变量
└── index.ts                    # 导出入口
```

---

## 3. 详细设计

### 3.1 CLI 入口

```bash
# 导出最新 session
bun run src/main.ts --export-html > ~/Desktop/session-replay.html

# 导出指定 session
bun run src/main.ts --export-html --session-id abc123 -o replay.html

# 指定主题
FLOW_THEME=archive bun run src/main.ts --export-html -o replay.html

# 导出时附带 AI 摘要（如果已缓存）
bun run src/main.ts --export-html --with-summaries -o replay.html
```

**参数：**

| Flag | Default | Description |
|------|---------|-------------|
| `--export-html` | — | 启用 HTML 导出模式 |
| `--session-id <id>` | latest | 指定 session |
| `-o, --output <path>` | stdout | 输出文件路径 |
| `--with-summaries` | false | 包含 AI 摘要缓存 |
| `--strip-thinking` | false | 去除 thinking 节点（减小体积） |
| `--max-detail-length` | 2000 | 每个 node detail 最大字符数 |

### 3.2 导出引擎实现

```typescript
// scheme/src/export/html-replay/export-html.ts

import {
  findLatestSession,
  extractExplorationsFromSession,
  extractSessionStats,
  extractLastPrompt,
} from '../../services/session/posthoc';
import { getThemeByName } from '../../app/ui/themes';
import { buildTemplate } from './template';
import { buildStyles } from './styles';
import { buildPlayerScript } from './player';
import { themeToCssVars } from './theme-to-css';
import type { ReplaySessionData } from './types';

export interface ExportHtmlOptions {
  sessionId?: string;
  outputPath?: string;
  withSummaries?: boolean;
  stripThinking?: boolean;
  maxDetailLength?: number;
  theme?: string;
}

export async function exportSessionToHtml(options: ExportHtmlOptions): Promise<string> {
  const cwd = process.env.FLOW_PROJECT_DIR || process.cwd();
  
  // 1. 找到 session 文件
  const sessionPath = findLatestSession(cwd);
  if (!sessionPath) throw new Error('No session found');

  // 2. 读取并解析
  const content = await Bun.file(sessionPath).text();
  const explorations = extractExplorationsFromSession(sessionPath, content);
  const stats = extractSessionStats(sessionPath, content);
  const prompt = extractLastPrompt(sessionPath);

  // 3. 构建 ReplaySessionData
  const sessionData: ReplaySessionData = {
    meta: {
      sessionId: options.sessionId || path.basename(sessionPath, '.jsonl'),
      prompt,
      startedAt: explorations[0]?.startedAt || Date.now(),
      endedAt: explorations[explorations.length - 1]?.endedAt || Date.now(),
      durationMs: /* 计算 */ 0,
      model: process.env.CLAUDE_MODEL || 'unknown',
      projectDir: sanitizePath(cwd),
      generatedAt: new Date().toISOString(),
      generatorVersion: 'flow-replay/0.1.0',
    },
    stats: {
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      cacheReadTokens: stats.cacheReadTokens,
      cacheWriteTokens: stats.cacheWriteTokens,
      costUsd: stats.costUsd,
      turns: stats.turns,
      totalToolCalls: countTools(explorations),
      totalErrors: countErrors(explorations),
    },
    explorations: transformExplorations(explorations, options),
    fileAccess: buildFileAccessMap(explorations),
    theme: options.theme || process.env.FLOW_THEME || 'transparent',
  };

  // 4. 组装 HTML
  const themeCss = themeToCssVars(getThemeByName(sessionData.theme));
  const css = buildStyles(themeCss);
  const js = buildPlayerScript();
  const dataJson = JSON.stringify(sessionData);

  return buildTemplate({ css, js, dataJson, title: prompt });
}
```

### 3.3 HTML 模板结构

```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="transparent">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Flow Replay: {{TITLE}}</title>
  <style>{{CSS}}</style>
</head>
<body>
  <!-- 数据存储 -->
  <script id="session-data" type="application/json">{{DATA_JSON}}</script>

  <!-- 应用根节点 -->
  <div id="app">
    <!-- Header: 标题 + 统计概览 -->
    <header id="header">
      <div class="logo">🌊 Flow Replay</div>
      <div class="session-title"></div>
      <div class="session-meta"></div>
    </header>

    <!-- 播放控制条 -->
    <div id="player-bar">
      <button id="btn-play">▶</button>
      <button id="btn-pause" hidden>⏸</button>
      <input type="range" id="progress" min="0" max="100" value="0">
      <span id="time-display">00:00 / 00:00</span>
      <select id="speed-select">
        <option value="1">1×</option>
        <option value="2">2×</option>
        <option value="4">4×</option>
        <option value="8">8×</option>
      </select>
    </div>

    <!-- 主内容区（双栏） -->
    <div id="main-content">
      <!-- 左侧：时间线 -->
      <aside id="timeline">
        <div id="search-bar">
          <input type="text" placeholder="搜索工具、文件、内容..." id="search-input">
        </div>
        <div id="exploration-list">
          <!-- 动态生成 -->
        </div>
      </aside>

      <!-- 右侧：详情面板 -->
      <main id="detail-panel">
        <div id="detail-header"></div>
        <div id="detail-body">
          <pre><code id="detail-code"></code></pre>
        </div>
      </main>
    </div>

    <!-- 底部：统计信息 -->
    <footer id="stats-bar">
      <div class="stat">🔧 <span id="stat-tools">0</span> tools</div>
      <div class="stat">📁 <span id="stat-files">0</span> files</div>
      <div class="stat">⚠️ <span id="stat-errors">0</span> errors</div>
      <div class="stat">💰 $<span id="stat-cost">0.00</span></div>
      <div class="stat">⏱️ <span id="stat-duration">0m</span></div>
    </footer>
  </div>

  <!-- 前端逻辑 -->
  <script>{{JS}}</script>
</body>
</html>
```

### 3.4 前端播放器核心逻辑

```javascript
// scheme/src/export/html-replay/player.ts
// 这会被内联到 HTML 的 <script> 中

const PLAYER_SCRIPT = `
(function() {
  'use strict';

  // ── 数据加载 ──
  const raw = document.getElementById('session-data').textContent;
  const session = JSON.parse(raw);

  // ── 状态 ──
  let state = {
    playing: false,
    speed: 1,
    currentExplorationIdx: 0,
    currentNodeIdx: -1,
    allNodes: [],         // 扁平化所有 nodes，按 timestamp 排序
    startTime: 0,
    elapsed: 0,
    animFrame: null,
    searchQuery: '',
    filteredNodes: null,  // null = 不过滤
  };

  // ── 初始化：扁平化节点 ──
  function flattenNodes() {
    const nodes = [];
    for (const exp of session.explorations) {
      for (const node of exp.nodes) {
        nodes.push({ ...node, explorationId: exp.id, question: exp.question });
      }
    }
    nodes.sort((a, b) => a.timestamp - b.timestamp);
    return nodes;
  }
  state.allNodes = flattenNodes();

  // ── 时间线渲染 ──
  function renderTimeline() {
    const container = document.getElementById('exploration-list');
    container.innerHTML = '';
    
    for (let i = 0; i < session.explorations.length; i++) {
      const exp = session.explorations[i];
      const el = document.createElement('div');
      el.className = 'exploration-item' + (i === state.currentExplorationIdx ? ' active' : '');
      el.dataset.idx = i;
      
      const statusIcon = exp.status === 'complete' ? '✓' : 
                          exp.status === 'interrupted' ? '⚡' : '●';
      const phaseClass = 'phase-' + exp.currentPhase;
      
      el.innerHTML = \`
        <div class="exp-header">
          <span class="exp-status \${phaseClass}">\${statusIcon}</span>
          <span class="exp-question">\${escapeHtml(exp.question).slice(0, 80)}</span>
        </div>
        <div class="exp-meta">
          <span class="exp-nodes">\${exp.nodes.length} nodes</span>
          <span class="exp-errors">\${exp.errorCounts.tool + exp.errorCounts.system} errors</span>
          <span class="exp-time">\${formatDuration(exp.endedAt - exp.startedAt)}</span>
        </div>
        \${exp.summary ? '<div class="exp-summary">' + escapeHtml(exp.summary) + '</div>' : ''}
        <div class="exp-nodes-list" id="nodes-\${i}"></div>
      \`;
      
      el.addEventListener('click', () => jumpToExploration(i));
      container.appendChild(el);
      
      // 渲染该 exploration 的 nodes
      renderExplorationNodes(exp, i);
    }
  }

  function renderExplorationNodes(exp, expIdx) {
    const container = document.getElementById('nodes-' + expIdx);
    if (!container) return;
    
    for (let j = 0; j < exp.nodes.length; j++) {
      const node = exp.nodes[j];
      if (state.filteredNodes && !matchesSearch(node)) continue;
      
      const nodeEl = document.createElement('div');
      nodeEl.className = 'node-item node-' + node.type + 
                          (node.status === 'error' ? ' node-error' : '');
      nodeEl.dataset.expIdx = expIdx;
      nodeEl.dataset.nodeIdx = j;
      
      const icon = { tool: '🔧', result: '✓', response: '💬', thinking: '💭', error: '❌' }[node.type] || '·';
      const time = formatTime(node.timestamp - session.meta.startedAt);
      
      nodeEl.innerHTML = \`
        <span class="node-time">\${time}</span>
        <span class="node-icon">\${icon}</span>
        <span class="node-label">\${escapeHtml(node.label).slice(0, 100)}</span>
      \`;
      
      nodeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showDetail(node, exp);
        highlightNode(expIdx, j);
      });
      
      container.appendChild(nodeEl);
    }
  }

  // ── 详情面板 ──
  function showDetail(node, exploration) {
    const header = document.getElementById('detail-header');
    const body = document.getElementById('detail-code');
    
    const icon = { tool: '🔧', result: '✓', response: '💬', thinking: '💭', error: '❌' }[node.type];
    header.innerHTML = \`
      <span class="detail-icon">\${icon}</span>
      <span class="detail-type">\${node.type}</span>
      \${node.toolName ? '<span class="detail-tool">' + node.toolName + '</span>' : ''}
      \${node.filePath ? '<span class="detail-file">' + node.filePath + '</span>' : ''}
      <span class="detail-time">\${new Date(node.timestamp).toLocaleTimeString()}</span>
    \`;
    
    body.textContent = node.detail || node.label;
    
    // 如果是代码/diff，尝试高亮
    if (node.detail && (node.toolName === 'edit' || node.toolName === 'write')) {
      body.className = 'language-diff';
    } else {
      body.className = '';
    }
  }

  // ── 播放引擎 ──
  function play() {
    if (state.allNodes.length === 0) return;
    state.playing = true;
    state.startTime = Date.now() - state.elapsed;
    document.getElementById('btn-play').hidden = true;
    document.getElementById('btn-pause').hidden = false;
    tick();
  }

  function pause() {
    state.playing = false;
    state.elapsed = Date.now() - state.startTime;
    document.getElementById('btn-play').hidden = false;
    document.getElementById('btn-pause').hidden = true;
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
  }

  function tick() {
    if (!state.playing) return;
    
    const realElapsed = (Date.now() - state.startTime) * state.speed;
    const sessionDuration = session.meta.durationMs || 
                            (state.allNodes[state.allNodes.length - 1].timestamp - state.allNodes[0].timestamp);
    
    // 找到当前应该显示到哪个 node
    const sessionStart = state.allNodes[0].timestamp;
    const currentSessionTime = sessionStart + realElapsed;
    
    let targetIdx = state.currentNodeIdx;
    while (targetIdx + 1 < state.allNodes.length && 
           state.allNodes[targetIdx + 1].timestamp <= currentSessionTime) {
      targetIdx++;
    }
    
    if (targetIdx !== state.currentNodeIdx && targetIdx >= 0) {
      state.currentNodeIdx = targetIdx;
      const node = state.allNodes[targetIdx];
      // 找到对应的 exploration
      const expIdx = session.explorations.findIndex(e => e.id === node.explorationId);
      if (expIdx !== state.currentExplorationIdx) {
        state.currentExplorationIdx = expIdx;
        renderTimeline(); // 重新渲染高亮
      }
      showDetail(node, session.explorations[expIdx]);
      highlightNode(expIdx, node); // 视觉滚动
    }
    
    // 更新进度条
    const progress = Math.min(100, (realElapsed / sessionDuration) * 100);
    document.getElementById('progress').value = progress;
    document.getElementById('time-display').textContent = 
      formatDuration(realElapsed) + ' / ' + formatDuration(sessionDuration);
    
    if (realElapsed >= sessionDuration) {
      pause();
      return;
    }
    
    state.animFrame = requestAnimationFrame(tick);
  }

  // ── 搜索 ──
  function handleSearch(query) {
    state.searchQuery = query.toLowerCase().trim();
    state.filteredNodes = state.searchQuery ? true : null;
    renderTimeline();
  }

  function matchesSearch(node) {
    const q = state.searchQuery;
    if (!q) return true;
    return (node.label || '').toLowerCase().includes(q) ||
           (node.toolName || '').toLowerCase().includes(q) ||
           (node.filePath || '').toLowerCase().includes(q) ||
           (node.detail || '').toLowerCase().includes(q);
  }

  // ── 工具函数 ──
  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  
  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return String(m).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0');
  }
  
  function formatDuration(ms) {
    if (!ms || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    return m + ':' + String(s).padStart(2,'0');
  }

  function highlightNode(expIdx, nodeIdx) {
    document.querySelectorAll('.node-item.highlighted').forEach(el => el.classList.remove('highlighted'));
    const el = document.querySelector('[data-exp-idx="'+expIdx+'"][data-node-idx="'+nodeIdx+'"]');
    if (el) {
      el.classList.add('highlighted');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function jumpToExploration(idx) {
    state.currentExplorationIdx = idx;
    const exp = session.explorations[idx];
    if (exp.nodes.length > 0) {
      showDetail(exp.nodes[0], exp);
    }
    renderTimeline();
  }

  // ── 统计面板渲染 ──
  function renderStats() {
    document.getElementById('stat-tools').textContent = session.stats.totalToolCalls;
    document.getElementById('stat-files').textContent = Object.keys(session.fileAccess).length;
    document.getElementById('stat-errors').textContent = session.stats.totalErrors;
    document.getElementById('stat-cost').textContent = session.stats.costUsd.toFixed(3);
    document.getElementById('stat-duration').textContent = formatDuration(session.meta.durationMs);
  }

  // ── 事件绑定 ──
  document.getElementById('btn-play').addEventListener('click', play);
  document.getElementById('btn-pause').addEventListener('click', pause);
  document.getElementById('speed-select').addEventListener('change', (e) => {
    state.speed = Number(e.target.value);
  });
  document.getElementById('progress').addEventListener('input', (e) => {
    const pct = Number(e.target.value) / 100;
    const duration = session.meta.durationMs || 
                     (state.allNodes[state.allNodes.length-1].timestamp - state.allNodes[0].timestamp);
    state.elapsed = pct * duration;
    state.startTime = Date.now() - state.elapsed;
    // 立即更新显示
    if (!state.playing) tick();
  });
  document.getElementById('search-input').addEventListener('input', (e) => {
    handleSearch(e.target.value);
  });
  
  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch(e.key) {
      case ' ': e.preventDefault(); state.playing ? pause() : play(); break;
      case 'ArrowRight': jumpForward(); break;
      case 'ArrowLeft': jumpBackward(); break;
      case 'j': nextExploration(); break;
      case 'k': prevExploration(); break;
    }
  });

  function jumpForward() {
    if (state.currentNodeIdx < state.allNodes.length - 1) {
      state.currentNodeIdx++;
      const node = state.allNodes[state.currentNodeIdx];
      const expIdx = session.explorations.findIndex(e => e.id === node.explorationId);
      showDetail(node, session.explorations[expIdx]);
    }
  }

  function jumpBackward() {
    if (state.currentNodeIdx > 0) {
      state.currentNodeIdx--;
      const node = state.allNodes[state.currentNodeIdx];
      const expIdx = session.explorations.findIndex(e => e.id === node.explorationId);
      showDetail(node, session.explorations[expIdx]);
    }
  }

  function nextExploration() {
    if (state.currentExplorationIdx < session.explorations.length - 1) {
      jumpToExploration(state.currentExplorationIdx + 1);
    }
  }

  function prevExploration() {
    if (state.currentExplorationIdx > 0) {
      jumpToExploration(state.currentExplorationIdx - 1);
    }
  }

  // ── 启动 ──
  renderTimeline();
  renderStats();
  document.querySelector('.session-title').textContent = session.meta.prompt.slice(0, 120);
  document.querySelector('.session-meta').textContent = 
    session.meta.model + ' | ' + new Date(session.meta.startedAt).toLocaleString();

})();
`;
```

### 3.5 样式设计（复用主题系统）

```typescript
// scheme/src/export/html-replay/theme-to-css.ts
import type { ColorScheme } from '../../app/ui/themes';

export function themeToCssVars(theme: ColorScheme): string {
  return `
    :root {
      --bg-primary: ${theme.bg.primary};
      --bg-secondary: ${theme.bg.secondary};
      --bg-tertiary: ${theme.bg.tertiary};
      --bg-highlight: ${theme.bg.highlight};
      --fg-primary: ${theme.fg.primary};
      --fg-secondary: ${theme.fg.secondary};
      --fg-muted: ${theme.fg.muted};
      --fg-dim: ${theme.fg.dim};
      --accent-primary: ${theme.accent.primary};
      --accent-secondary: ${theme.accent.secondary};
      --accent-tertiary: ${theme.accent.tertiary};
      --status-success: ${theme.status.success};
      --status-warning: ${theme.status.warning};
      --status-error: ${theme.status.error};
      --status-info: ${theme.status.info};
      --border-normal: ${theme.border.normal};
      --border-active: ${theme.border.active};
      --border-muted: ${theme.border.muted};
    }
  `;
}
```

主样式 (~3KB gzip) 核心规则：

```css
/* 布局 */
#app { display: grid; grid-template-rows: auto auto 1fr auto; height: 100vh; }
#main-content { display: grid; grid-template-columns: 340px 1fr; overflow: hidden; }
#timeline { overflow-y: auto; border-right: 1px solid var(--border-normal); }
#detail-panel { overflow-y: auto; padding: 16px; }

/* 播放控制条 */
#player-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-normal);
}
#progress { flex: 1; }

/* 节点样式 */
.node-item { padding: 4px 12px; border-left: 3px solid transparent; cursor: pointer; }
.node-item:hover { background: var(--bg-highlight); }
.node-item.highlighted { border-left-color: var(--accent-primary); background: var(--bg-highlight); }
.node-tool { border-left-color: var(--status-info); }
.node-error { border-left-color: var(--status-error); }
.node-response { border-left-color: var(--status-success); }

/* 响应式 */
@media (max-width: 768px) {
  #main-content { grid-template-columns: 1fr; }
  #timeline { max-height: 40vh; }
}
```

---

## 4. 与现有系统的集成点

### 4.1 复用现有代码

| 现有模块 | 复用方式 |
|----------|----------|
| `posthoc.ts` → `extractExplorationsFromSession` | 直接调用，获取结构化 explorations |
| `posthoc.ts` → `extractSessionStats` | 直接调用，获取 token/cost 统计 |
| `posthoc.ts` → `findLatestSession` | 直接调用，发现 session 文件 |
| `themes/index.ts` | 导入主题定义，转为 CSS variables |
| `summary-cache.ts` | 读取已缓存的 AI 摘要，嵌入 HTML |
| `flow-summaries.ts` → `parseExplorationSummaryAIOutput` | 格式化摘要数据 |

### 4.2 main.ts 集成

在 `main.ts` 中添加 `--export-html` 分支：

```typescript
// scheme/src/main.ts 中添加
if (args.includes('--export-html')) {
  const { exportSessionToHtml } = await import('./export/html-replay/export-html');
  const html = await exportSessionToHtml({
    sessionId: getArgValue(args, '--session-id'),
    outputPath: getArgValue(args, '-o') || getArgValue(args, '--output'),
    withSummaries: args.includes('--with-summaries'),
    stripThinking: args.includes('--strip-thinking'),
    theme: process.env.FLOW_THEME,
  });
  
  if (outputPath) {
    await Bun.write(outputPath, html);
    console.error(`✅ Exported to: ${outputPath}`);
  } else {
    process.stdout.write(html);
  }
  process.exit(0);
}
```

### 4.3 TUI 快捷键集成

在 Observer 的 CommandBar 中添加 `[e] export html`：

```typescript
// 在 FlowObserverShell.tsx 的 key handler 中
case 'e':
  // 异步导出当前 session 为 HTML
  exportCurrentSessionHtml();
  setStatusMessage('📦 Exporting HTML...');
  break;
```

### 4.4 通知系统集成

导出完成后，可以通过现有通知系统推送：

```
📦 Flow Replay 已生成

文件: ~/Desktop/session-2026-05-21.html
大小: 128KB
包含: 5 explorations, 67 tool calls

📊 Session: abc123
⏱️ 持续: 15m32s
💰 花费: $0.23
```

---

## 5. 体积优化策略

目标：典型 30 分钟 session 的 HTML < 500KB（gzip 后 < 100KB）

| 优化 | 预估节省 |
|------|----------|
| `detail` 字段截断（默认 2000 字符） | -60% 数据量 |
| `--strip-thinking` 去除 thinking 节点 | -30% 节点数 |
| CSS/JS minify（build 时） | -40% 资源 |
| 不嵌入字体（使用系统字体栈） | -200KB |
| JSON 数据 key 缩短（生产模式） | -10% |

### 体积预估

| Session 规模 | 原始 JSONL | 导出 HTML (无 thinking) | Gzip |
|--------------|-----------|------------------------|------|
| 10 min / 20 tools | ~200KB | ~80KB | ~20KB |
| 30 min / 60 tools | ~600KB | ~200KB | ~50KB |
| 60 min / 150 tools | ~1.5MB | ~500KB | ~120KB |

---

## 6. 安全与隐私

### 6.1 默认脱敏

```typescript
function sanitizePath(absPath: string): string {
  // 替换 home 目录为 ~
  const home = process.env.HOME || '';
  if (home && absPath.startsWith(home)) {
    return '~' + absPath.slice(home.length);
  }
  return absPath;
}

function sanitizeEnvVars(text: string): string {
  // 移除环境变量值（保留 key）
  return text.replace(/(export\s+\w+=).+/g, '$1[REDACTED]')
             .replace(/(token|secret|password|key)["']?\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[REDACTED]');
}
```

### 6.2 可选：完全匿名模式

```bash
bun run src/main.ts --export-html --anonymize -o replay.html
```

- 替换所有绝对路径为相对路径
- 移除 session ID
- 模糊化时间戳（只保留相对时间）

---

## 7. 未来扩展（v2+）

### 7.1 Mermaid 图表嵌入
```html
<!-- 文件依赖关系图 -->
<div id="file-graph">
  <script type="text/mermaid">
    graph LR
      A[src/main.ts] --> B[src/utils.ts]
      A --> C[src/types.ts]
  </script>
</div>
```

### 7.2 Diff 高亮
对 `edit_file` / `write_file` 类型的 tool，解析 input 中的 diff 内容，渲染为带颜色的 diff view。

### 7.3 Token 消耗时间线图
用 inline SVG 画一个小型的 token 消耗折线图。

### 7.4 分享链接生成
可选上传到 GitHub Gist / S3，生成短链接。

### 7.5 对比模式
两个 session 的 replay 并排显示，比较不同策略的效率。

---

## 8. 实施计划

### Phase 1: MVP（1-2 天）
- [ ] 创建 `scheme/src/export/html-replay/` 目录结构
- [ ] 实现 `export-html.ts` 核心导出逻辑
- [ ] 实现 HTML 模板（静态时间线，点击查看详情）
- [ ] 集成 `--export-html` 到 `main.ts`
- [ ] 基础 CSS（只用 transparent 主题）
- [ ] 手动测试：用真实 session 导出并验证

### Phase 2: 播放器（1 天）
- [ ] 实现 play/pause/speed 播放引擎
- [ ] 进度条拖拽跳转
- [ ] 自动滚动 + 高亮当前节点
- [ ] 键盘快捷键（空格、方向键、j/k）

### Phase 3: 增强（1 天）
- [ ] 搜索功能
- [ ] 主题系统对接（所有 30 种主题）
- [ ] 响应式布局（移动端）
- [ ] `--with-summaries` 集成 AI 摘要缓存
- [ ] TUI 快捷键 `e` 集成

### Phase 4: 打磨（0.5 天）
- [ ] 体积优化 + minify
- [ ] 安全脱敏
- [ ] README 更新
- [ ] 添加到通知系统（导出完成推送）

### 总预估：3.5-4.5 天

---

## 9. 验收标准

1. ✅ `bun run src/main.ts --export-html` 输出有效 HTML
2. ✅ HTML 在 Chrome / Firefox / Safari 中正常打开
3. ✅ 播放功能流畅（60fps，无卡顿）
4. ✅ 典型 session HTML < 500KB
5. ✅ 搜索能找到工具名和文件名
6. ✅ 手机上（Chrome Mobile）可正常查看
7. ✅ 不含任何外部网络请求（完全离线）
8. ✅ 不泄露 token / secret 等敏感信息

---

## 10. 命令速查

```bash
# 导出最新 session（输出到 stdout）
bun run src/main.ts --export-html > replay.html

# 导出指定 session 到文件
bun run src/main.ts --export-html --session-id abc123 -o replay.html

# 使用 archive 主题导出
FLOW_THEME=archive bun run src/main.ts --export-html -o replay.html

# 轻量导出（去掉 thinking，detail 限制 500 字符）
bun run src/main.ts --export-html --strip-thinking --max-detail-length 500 -o light.html

# 在 TUI 中直接导出（按 e 键）
# → 文件保存到 ~/.flow-sessions/<session-id>/replay.html
```

---

## Appendix A: 快捷键表

| 键 | 动作 |
|----|------|
| `Space` | Play / Pause |
| `→` | 下一个节点 |
| `←` | 上一个节点 |
| `j` | 下一个 Exploration |
| `k` | 上一个 Exploration |
| `f` | 聚焦搜索框 |
| `Esc` | 清除搜索 / 退出聚焦 |
| `1-4` | 设置播放速度 1×/2×/4×/8× |

---

## Appendix B: 与其他工具的对比

| 工具 | 格式 | 交互 | 数据 | 分享 |
|------|------|------|------|------|
| asciinema | 终端录屏 | 只能回放 | 纯文本流 | 需要服务器 |
| Carbon | 截图 | 无 | 静态代码片段 | 图片 |
| **Flow Replay** | **单 HTML** | **可搜索、可跳转、可变速** | **结构化 session** | **双击打开** |
| Jupyter Notebook | .ipynb | 有 | Cell-based | 需要 viewer |

---

*End of RFC*
