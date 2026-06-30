import React, { useCallback, useEffect, useRef, useState } from 'react';
import claudeCodeLogo from '../assets/claudecode-color.svg';

const FLOW_SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const observeClaudeTranscript = [
  { type: 'user', text: 'refactor auth middleware for session binding' },
  { type: 'tool', name: 'Glob', detail: 'scheme/src/**/*auth*' },
  { type: 'output', lines: ['scheme/src/services/session/session-binding-policy.ts', 'scheme/src/data/session/session-discovery.ts', 'scheme/src/app/observer/hooks/useSessionPolling.ts'] },
  { type: 'tool', name: 'Read', detail: 'session-binding-policy.ts' },
  { type: 'output', lines: ['128 lines', 'export function resolveSessionBinding(...)'] },
  { type: 'tool', name: 'Read', detail: 'session-runtime-policy.ts' },
  { type: 'output', lines: ['94 lines', 'live vs replay policy chain'] },
  { type: 'assistant', text: 'Binding policy is the single source for resume modes. I will trace how JSONL events reach the observer hook next.' },
  { type: 'tool', name: 'Grep', detail: 'useSessionPolling' },
  { type: 'output', lines: ['3 files matched', 'LiveObserverContainer.tsx imports hook'] },
  { type: 'tool', name: 'Read', detail: 'useSessionPolling.ts' },
  { type: 'output', lines: ['212 lines', 'poll interval 800ms default'] },
  { type: 'tool', name: 'Bash', detail: 'cd scheme && bun test session-binding' },
  { type: 'output', lines: ['pass 14', 'fail 0', 'Ran 14 tests across 2 files'] },
  { type: 'assistant', text: 'Tests pass on binding policy. Next I will tighten the replay banner copy and regen gate.' },
  { type: 'tool', name: 'Edit', detail: 'session-banner.ts' },
  { type: 'output', lines: ['updated replay hint string'] },
  { type: 'tool', name: 'Bash', detail: 'bun test session-runtime-policy' },
  { type: 'output', lines: ['pass 22', 'fail 0'] },
  { type: 'system', kind: 'meta', text: 'Baked for 1m 12s' },
  { type: 'user', text: 'map how wiki curator triggers on pivot' },
  { type: 'tool', name: 'Read', detail: 'wiki-curator-service.ts' },
  { type: 'output', lines: ['idle sweep after 45s', 'pivot on intent_key change'] },
  { type: 'tool', name: 'Read', detail: 'wiki-persist-policy.ts' },
  { type: 'output', lines: ['ineligible intents skip write badge'] },
  { type: 'assistant', text: 'Curator runs on pivot and idle sweep only. I will add a test for the skip path.' },
  { type: 'tool', name: 'Bash', detail: 'bun test wiki-persist-policy' },
  { type: 'output', lines: ['pass 9', 'fail 0', 'running...'] },
];

const observeExplorations = [
  {
    id: 'e1',
    status: 'complete',
    intentBadge: 'Explore',
    intentTitle: 'Auth Middleware Map',
    toolMeta: 'Done · 6 tools · Read×4 · Glob×1 · Grep×1',
    summary: 'Located binding policy, runtime policy, and polling hook. JSONL ingestion stays read-only on the Claude side.',
  },
  {
    id: 'e2',
    status: 'complete',
    intentBadge: 'Implement',
    intentTitle: 'Replay Banner Copy',
    toolMeta: 'Done · 2 tools · Edit×1 · Bash×1',
    wikiBadge: 'wiki saved · pivot closed intent bucket',
    summary: 'Tightened replay banner text in session-banner.ts. Runtime policy tests still green.',
  },
  {
    id: 'e3',
    status: 'complete',
    intentBadge: 'Explore',
    intentTitle: 'Wiki Curator Triggers',
    toolMeta: 'Done · 2 tools · Read×2',
    knowledge: {
      id: 'C001',
      excerpt: 'Wiki writes are gated on pivot and idle sweep. Ineligible intents never show a write badge in the observer UI.',
      tags: ['wiki', 'curator'],
    },
    summary: 'Curator fires on intent_key pivot or idle sweep, not every exploration turn.',
  },
  {
    id: 'e4',
    status: 'running',
    intentBadge: 'Verify',
    intentTitle: 'Persist Policy Tests',
    toolMeta: 'Active · 1 tool · Bash×1',
    summary: null,
  },
];

const flowchartTree = [
  { id: 'e1', intent: 'Explore', title: 'Auth Middleware Map', status: 'done', children: [] },
  { id: 'e2', intent: 'Implement', title: 'Replay Banner Copy', status: 'done', children: [] },
  {
    id: 'e3',
    intent: 'Explore',
    title: 'Wiki Curator Triggers',
    status: 'done',
    children: [{ id: 'e4', intent: 'Verify', title: 'Persist Policy Tests', status: 'active', children: [] }],
  },
];

const workspaceTreeRows = [
  { id: 'root', prefix: '', marker: '▾', name: 'GUI-Anything', kind: 'root' },
  { id: 'scheme', prefix: '├── ', marker: '▾', name: 'scheme', kind: 'dir' },
  { id: 'src', prefix: '│   ├── ', marker: '▾', name: 'src', kind: 'dir' },
  { id: 'app', prefix: '│   │   ├── ', marker: '▾', name: 'app', kind: 'dir' },
  { id: 'ui', prefix: '│   │   │   └── ', marker: '▾', name: 'ui/flow', kind: 'dir', recent: true },
  { id: 'shell', prefix: '│   │   │       ├── ', marker: '·', name: 'FlowObserverShell.tsx', kind: 'file', active: true },
  { id: 'hotkeys', prefix: '│   │   │       ├── ', marker: '·', name: 'observer-hotkeys.ts', kind: 'file', recent: true },
  { id: 'workspace', prefix: '│   │   │       └── ', marker: '▾', name: 'workspace', kind: 'dir', recent: true },
  { id: 'workspace-view', prefix: '│   │   │           └── ', marker: '·', name: 'WorkspaceView.tsx', kind: 'file', active: true },
  { id: 'services', prefix: '│   │   ├── ', marker: '▾', name: 'services/evolution', kind: 'dir' },
  { id: 'data', prefix: '│   │   └── ', marker: '▾', name: 'data/protocol', kind: 'dir' },
  { id: 'docs', prefix: '├── ', marker: '▾', name: 'docs/src', kind: 'dir', recent: true },
  { id: 'site-content', prefix: '│   ├── ', marker: '·', name: 'site-content.js', kind: 'file', recent: true },
  { id: 'flow-terminal', prefix: '│   └── ', marker: '·', name: 'FlowTerminal.jsx', kind: 'file', active: true },
  { id: 'scripts', prefix: '├── ', marker: '▾', name: 'scripts', kind: 'dir' },
  { id: 'flow-run', prefix: '│   └── ', marker: '·', name: 'flow-run.sh', kind: 'file' },
  { id: 'readme', prefix: '└── ', marker: '·', name: 'README.md', kind: 'file' },
];

const workspaceTraceRows = [
  { id: 't1', glyph: '✓', action: 'run', summary: "find . -maxdepth 2 -not -path './node_modules/*'" },
  { id: 't2', glyph: '✓', action: 'read', summary: 'docs/development.md · AGENTS.md' },
  { id: 't3', glyph: '●', action: 'edit', summary: 'docs/src/FlowTerminal.jsx · workspace demo' },
];

const sessionNotes = [
  {
    id: 'n1',
    text: 'hello',
    created: '2026-06-08T11:04:00.000Z',
  },
];

const initialExplorations = [
  {
    id: 'e0',
    status: 'complete',
    intentBadge: 'Task',
    intentTitle: 'Awaiting task',
    toolMeta: 'Done · 0 tools',
    summary: 'Ready when you are.',
  },
];

function formatNoteTimestamp(iso) {
  const s = (iso || '').trim();
  if (!s) return '';
  const date = s.slice(0, 10);
  const time = s.slice(11, 16);
  if (date.length < 10) return s.slice(0, 16);
  return `${date} ${time}`;
}

const replayExplorations = observeExplorations.map((item) => ({
  ...item,
  status: 'complete',
  summary: item.summary ?? 'Replayed from wiki/sessions/session-a/bundle.json with cached summaries.',
}));

const knowledgeExplorations = [
  observeExplorations[0],
  {
    ...observeExplorations[1],
    status: 'complete',
  },
  {
    ...observeExplorations[2],
    status: 'complete',
  },
];

export const terminalScenarios = [
  {
    id: 'idle',
    label: 'Idle',
    layout: 'dual',
    command: 'ga flow',
    claude: {
      prompt: 'hello',
      showGhost: true,
      transcript: [],
      footerModel: 'qwen3.6-flash',
      contextPct: 0,
    },
    observer: {
      mode: 'live',
      model: 'qwen3.6-flash',
      tokenDisplay: 'Tok 0',
      doneCount: 1,
      empty: false,
      explorations: initialExplorations,
    },
  },
  {
    id: 'flow',
    label: 'Timeline',
    layout: 'dual',
    command: 'ga flow --model sonnet "refactor auth middleware"',
    claude: {
      prompt: 'map how wiki curator triggers on pivot',
      showGhost: false,
      transcript: observeClaudeTranscript,
      footerModel: 'sonnet',
      contextPct: 34,
    },
    observer: {
      mode: 'live',
      model: 'sonnet',
      tokenDisplay: 'Tok 8.1k',
      doneCount: 3,
      currentIntent: {
        badge: 'Explore',
        title: 'Wiki Curator Triggers',
      },
      empty: false,
      explorations: observeExplorations,
    },
  },
  {
    id: 'timeline',
    label: 'Focus',
    layout: 'timeline',
    command: 'ga flow  (press g for flowchart)',
    claude: {
      prompt: '',
      showGhost: false,
      transcript: observeClaudeTranscript.slice(0, 14),
      footerModel: 'sonnet',
      contextPct: 28,
    },
    observer: {
      mode: 'live',
      model: 'sonnet',
      tokenDisplay: 'Tok 6.4k',
      doneCount: 3,
      empty: false,
      flowchart: flowchartTree,
      focusId: 'e4',
    },
  },
  {
    id: 'workspace',
    label: 'Workspace',
    layout: 'workspace',
    command: 'ga flow  (press g for workspace)',
    claude: {
      prompt: 'analyze the current project',
      showGhost: false,
      transcript: observeClaudeTranscript.slice(0, 10),
      footerModel: 'qwen3.6-flash',
      contextPct: 0,
    },
    observer: {
      mode: 'workspace',
      model: 'qwen3.6-flash',
      tokenDisplay: 'Tok 0',
      doneCount: 1,
      currentIntent: {
        badge: 'Design',
        title: 'Map GUI-Anything sidecar architecture',
      },
      workspace: {
        tree: workspaceTreeRows,
        trace: workspaceTraceRows,
      },
    },
  },
  {
    id: 'note',
    label: 'Note',
    layout: 'note',
    command: 'ga flow  (press i for notes)',
    claude: {
      prompt: '',
      showGhost: false,
      transcript: observeClaudeTranscript.slice(0, 8),
      footerModel: 'sonnet',
      contextPct: 22,
    },
    observer: {
      mode: 'live',
      model: 'sonnet',
      tokenDisplay: 'Tok 5.1k',
      doneCount: 2,
      empty: false,
      explorations: observeExplorations.slice(0, 2),
    },
    notes: sessionNotes,
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    layout: 'dual',
    command: 'ga flow  (prior wiki retrieval)',
    claude: {
      prompt: 'how does wiki curation gate on pivot?',
      showGhost: false,
      transcript: observeClaudeTranscript.slice(18, 28),
      footerModel: 'sonnet',
      contextPct: 26,
    },
    observer: {
      mode: 'live',
      model: 'sonnet',
      tokenDisplay: 'Tok 6.2k',
      doneCount: 3,
      currentIntent: {
        badge: 'Explore',
        title: 'Wiki Curator Triggers',
      },
      empty: false,
      explorations: knowledgeExplorations,
    },
  },
  {
    id: 'replay',
    label: 'Replay',
    layout: 'dual',
    command: 'ga flow -r session-a',
    claude: {
      prompt: '',
      showGhost: false,
      transcript: observeClaudeTranscript.slice(0, 12),
      footerModel: 'sonnet',
      contextPct: 0,
    },
    observer: {
      mode: 'replay',
      replayBanner: true,
      model: 'sonnet',
      tokenDisplay: 'Tok 7.8k',
      doneCount: 4,
      empty: false,
      explorations: replayExplorations,
    },
  },
];

const COMMAND_BAR_ROW_1 = 'g → Focus · i notes sidebar · c calm off · ? / F1 / Ctrl+/ / Ctrl-K help';
const COMMAND_BAR_ROW_2 = '[ ] theme · s notify on · k audit · h HTML · r regen · q quit';
const COMMAND_BAR_NOTES_ROW_1 = 'g → Timeline · Esc/i close notes · c calm off · ? / F1 / Ctrl+/ help';
const COMMAND_BAR_NOTES_ROW_2 = '[ ] theme · h HTML · r regen · Esc close · q quit';
const TERMINAL_SPLIT_PCT = 55;

function ClaudeLogo() {
  return <img className="claude-logo" src={claudeCodeLogo} alt="" aria-hidden="true" />;
}

function BlinkingCursor() {
  return <span className="term-cursor" aria-hidden="true">█</span>;
}

function useScrollFollow(ref, scenarioId, enabled = true) {
  const userScrolledRef = useRef(false);

  useEffect(() => {
    userScrolledRef.current = false;
  }, [scenarioId]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const onScroll = () => {
      const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
      userScrolledRef.current = !atBottom;
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [ref, scenarioId]);

  useEffect(() => {
    if (!enabled || !ref.current || userScrolledRef.current) return;
    const node = ref.current;
    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [scenarioId, enabled, ref]);
}

function useSpinner(enabled) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => {
      setFrame((value) => (value + 1) % FLOW_SPINNER.length);
    }, 120);
    return () => clearInterval(timer);
  }, [enabled]);

  return FLOW_SPINNER[frame];
}

function TranscriptLine({ entry }) {
  switch (entry.type) {
    case 'user':
      return (
        <div className="tx-block tx-user">
          <span className="term-prompt">&gt;</span> {entry.text}
        </div>
      );
    case 'assistant':
      return <div className="tx-block tx-assistant">{entry.text}</div>;
    case 'tool':
      return (
        <div className="tx-block tx-tool">
          <span className="tx-tool-name">{entry.name}</span>
          <span className="term-dim">({entry.detail})</span>
        </div>
      );
    case 'output':
      return (
        <div className="tx-block tx-output">
          {entry.lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      );
    case 'system':
      return (
        <div className={`tx-block tx-system tx-system-${entry.kind}`}>
          {entry.kind === 'meta' ? '*' : 'x'} {entry.text}
        </div>
      );
    default:
      return null;
  }
}

function ClaudePane({ scenario, scrollRef }) {
  const claude = scenario.claude;
  const hasTranscript = claude.transcript?.length > 0;
  const promptText = claude.showGhost ? '' : claude.prompt;

  return (
    <div className="term-pane term-pane-claude">
      <div className="term-pane-label">claude</div>

      {claude.showGhost ? (
        <div className="term-pane-scroll" ref={scrollRef}>
          <div className="claude-idle-header">
            <ClaudeLogo />
            <div className="claude-meta">
              <div>Claude Code v2.1.181</div>
              <div className="term-dim">qwen3.6-plus · API Usage Billing</div>
              <div className="term-dim">~/workspace/GUI-Anything</div>
            </div>
          </div>
          <div className="claude-auth-warning">
            <div>⚠ Both claude.ai and ANTHROPIC_API_KEY set · auth may not work as expected</div>
            <div className="term-dim">· to use claude.ai: unset the ANTHROPIC_API_KEY environment variable, or claude /logout then say "No" to the API key approval before login.</div>
            <div className="term-dim">· to use ANTHROPIC_API_KEY: claude /logout to sign out of claude.ai.</div>
          </div>
          <div className="claude-inline-prompt">
            <span className="term-prompt">&gt;</span>
            <span>{claude.prompt}</span>
          </div>
          <div className="claude-thought term-dim">Thought for <strong>5s</strong></div>
          <div className="claude-answer">● Hi! What can I help you with?</div>
          <div className="claude-worked term-dim">* Worked for 5s</div>
        </div>
      ) : (
        <div className="term-pane-scroll term-pane-scroll-claude" ref={scrollRef}>
          <div className="tx-stream">
            {claude.transcript.map((entry, index) => (
              <TranscriptLine entry={entry} key={`${entry.type}-${index}`} />
            ))}
            {hasTranscript && scenario.id === 'flow' ? (
              <div className="tx-block tx-running term-dim">
                <span className="tx-pulse" aria-hidden="true">●</span> Running bun test wiki-persist-policy...
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="claude-prompt-row">
        <span className="term-prompt">&gt;</span>
        <span className="claude-prompt-text">{promptText}</span>
        <BlinkingCursor />
      </div>
      <div className="claude-statusbar">
        <span>[{claude.footerModel}] {claude.contextPct}% context</span>
        <span className="term-dim">← for agents</span>
      </div>
    </div>
  );
}

function ExplorationCard({ exploration, calmMode, isLatest, spinnerFrame }) {
  const isRunning = exploration.status === 'running';
  const isActive = isRunning || exploration.status === 'active';
  const compact = calmMode && !isLatest && !isRunning;

  return (
    <article
      className={`exploration-card ${isActive ? 'is-active' : ''} ${isRunning ? 'is-running' : ''} ${compact ? 'is-compact' : ''}`}
    >
      <div className="exploration-intent">
        {exploration.intentBadge ? (
          <span className="intent-badge">
            <span className="intent-bracket">「</span>
            {exploration.intentBadge}
            <span className="intent-bracket">」</span>
          </span>
        ) : null}
        <span className="intent-title">{exploration.intentTitle}</span>
      </div>

      <div className="observer-tool-meta term-dim">
        {isRunning ? (
          <span><span className="tx-spinner" aria-hidden="true">{spinnerFrame}</span> {exploration.toolMeta}</span>
        ) : (
          exploration.toolMeta
        )}
      </div>

      {!compact && exploration.knowledge ? (
        <div className="knowledge-frame">
          <div className="knowledge-label">KNOWLEDGE · {exploration.knowledge.id}</div>
          <p className="knowledge-excerpt">{exploration.knowledge.excerpt}</p>
          <div className="knowledge-tags">
            {exploration.knowledge.tags.map((tag) => (
              <span className="knowledge-tag" key={tag}>
                <span className="intent-bracket">「</span>
                {tag}
                <span className="intent-bracket">」</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!compact && exploration.summary ? (
        <div className="summary-block">
          <div className="summary-label">SUMMARY</div>
          <p>{exploration.summary}</p>
        </div>
      ) : null}

      {!compact && isRunning ? (
        <div className="summary-block is-pending">
          <div className="summary-label">SUMMARY</div>
          <p>
            <span className="tx-spinner" aria-hidden="true">{spinnerFrame}</span> Summarizing...
          </p>
        </div>
      ) : null}

      {!compact && exploration.wikiBadge ? (
        <div className="wiki-badge-line">{exploration.wikiBadge}</div>
      ) : null}
    </article>
  );
}

function flattenFlowchartNodes(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) {
      flattenFlowchartNodes(node.children, out);
    }
  }
  return out;
}

function findFlowchartNode(nodes, id) {
  for (const node of flattenFlowchartNodes(nodes)) {
    if (node.id === id) return node;
  }
  return null;
}

function FlowchartTimelineRow({ node, isFocus }) {
  const isActive = node.status === 'active' || isFocus;

  return (
    <div
      className={`flowchart-node${isFocus ? ' is-focus' : ''}${isActive ? ' is-active' : ''}${!isActive ? ' is-done' : ''}`}
    >
      {isActive ? <span className="flowchart-prefix" aria-hidden="true">└ </span> : null}
      <span className="intent-badge">
        <span className="intent-bracket">「</span>
        {node.intent}
        <span className="intent-bracket">」</span>
      </span>
      <span className="flowchart-title">{node.title}</span>
      {isActive ? <span className="flowchart-active-dot" aria-hidden="true" /> : null}
    </div>
  );
}

function TimelinePane({ scenario, scrollRef }) {
  const obs = scenario.observer;
  const tree = obs.flowchart ?? [];
  const focusId = obs.focusId;
  const flatNodes = flattenFlowchartNodes(tree);
  const focusNode = findFlowchartNode(tree, focusId) ?? flatNodes[flatNodes.length - 1];

  return (
    <div className="term-pane term-pane-observer term-pane-timeline">
      <div className="term-pane-label">observer</div>

      <div className="observer-chrome">
        <div className="observer-status-line">
          <span>Focus</span>
          <span className="term-sep">·</span>
          <span className="term-dim">{focusId}</span>
          <span className="term-sep">·</span>
          <span className="term-dim">press g to return</span>
        </div>
      </div>

      <div className="term-pane-scroll term-pane-scroll-observer" ref={scrollRef}>
        <div className="flowchart-view">
          {focusNode ? (
            <div className="flowchart-focus-box">
              <div className="flowchart-focus-label">FOCUS</div>
              <p className="flowchart-focus-title">
                {focusNode.intent}
                <span className="flowchart-focus-sep"> · </span>
                {focusNode.title}
              </p>
              <p className="flowchart-focus-meta">Active exploration. Summarizer running.</p>
            </div>
          ) : null}
          <div className="flowchart-tree">
            {flatNodes.map((node) => (
              <FlowchartTimelineRow
                key={node.id}
                node={node}
                isFocus={node.id === focusId}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="observer-commandbar">
        <div className="term-dim cmd-static">g timeline · i notes · h HTML · r regen · ? help</div>
      </div>
    </div>
  );
}

function WorkspacePane({ scenario, scrollRef }) {
  const obs = scenario.observer;
  const workspace = obs.workspace ?? { tree: [], trace: [] };

  return (
    <div className="term-pane term-pane-observer term-pane-workspace">
      <div className="term-pane-label">observer</div>

      <div className="observer-chrome">
        <div className="observer-status-line">
          <span>Workspace</span>
          <span className="term-sep">·</span>
          <span>{obs.model}</span>
          <span className="term-sep">·</span>
          <span>{obs.tokenDisplay}</span>
          <span className="term-sep">·</span>
          <span>{obs.doneCount} done</span>
        </div>
        {obs.currentIntent ? (
          <div className="observer-current-intent">
            <span className="intent-badge">
              <span className="intent-bracket">「</span>
              {obs.currentIntent.badge}
              <span className="intent-bracket">」</span>
            </span>
            <span>{obs.currentIntent.title}</span>
          </div>
        ) : (
          <div className="observer-awaiting">° Awaiting task</div>
        )}
      </div>

      <div className="term-pane-scroll term-pane-scroll-observer" ref={scrollRef}>
        <div className="workspace-view">
          <div className="workspace-title">WORKSPACE</div>
          <div className="workspace-tree" aria-label="Workspace file tree">
            {workspace.tree.map((row) => (
              <div
                className={`workspace-tree-row is-${row.kind}${row.active ? ' is-active' : ''}${row.recent ? ' is-recent' : ''}`}
                key={row.id}
              >
                <span className="workspace-prefix">{row.prefix}</span>
                <span className="workspace-marker">{row.marker}</span>
                <span className="workspace-name">{row.name}</span>
                {row.active ? <span className="workspace-activity" aria-hidden="true">●</span> : null}
              </div>
            ))}
          </div>
          <div className="workspace-trace">
            <div className="workspace-title">TRACE</div>
            {workspace.trace.map((row) => (
              <div className="workspace-trace-row" key={row.id}>
                <span className="workspace-trace-glyph">{row.glyph}</span>
                <span className="workspace-trace-action">{row.action}</span>
                <span className="workspace-trace-summary">{row.summary}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="observer-commandbar">
        <div className="term-dim cmd-static">g timeline · i notes · c calm off · ? / help</div>
        <div className="term-dim cmd-static">[ ] theme · k audit · h HTML · r regen · q quit</div>
      </div>
    </div>
  );
}

function NotesPane({ notes: initialNotes, scrollRef }) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const handleSave = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setNotes((prev) => [
      {
        id: `n${Date.now()}`,
        text,
        created: new Date().toISOString(),
      },
      ...prev,
    ]);
    setDraft('');
    setInputFocused(false);
    inputRef.current?.blur();
  }, [draft]);

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setDraft('');
      setInputFocused(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="term-pane term-pane-notes">
      <div className="term-pane-label">notes</div>

      <div className="notes-header">Notes ({notes.length})</div>

      <div className="term-pane-scroll term-pane-scroll-notes" ref={scrollRef}>
        <div className="notes-list">
          {notes.length === 0 ? (
            <p className="notes-empty term-dim">No notes yet</p>
          ) : (
            notes.map((note) => (
              <div className="note-entry" key={note.id}>
                <div className="note-entry-text">{note.text}</div>
                {note.created ? (
                  <div className="note-entry-time term-dim">{formatNoteTimestamp(note.created)}</div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className={`notes-write ${inputFocused ? 'is-focused' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          setInputFocused(true);
          inputRef.current?.focus();
        }}
      >
        <div className="notes-write-label term-dim">Write note</div>
        <div className="notes-input-frame">
          <textarea
            ref={inputRef}
            className="notes-input"
            value={draft}
            placeholder="One concise insight (plain text)..."
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={handleInputKeyDown}
          />
        </div>
        {inputFocused ? (
          <div className="notes-input-hint term-dim">[Enter] Save</div>
        ) : null}
      </div>
    </div>
  );
}

function ObserverPane({
  scenario,
  calmMode,
  showHelp,
  showNotesSidebar,
  scrollRef,
  onToggleCalm,
  onToggleHelp,
  onToggleMode,
}) {
  const obs = scenario.observer;
  const modeLabel = obs.mode === 'replay' ? 'Replay' : 'Live';
  const explorations = obs.explorations ?? [];
  const hasRunning = explorations.some((item) => item.status === 'running');
  const spinnerFrame = useSpinner(hasRunning);

  return (
    <div className="term-pane term-pane-observer">
      <div className="term-pane-label">observer</div>

      <div className="observer-chrome">
        <div className="observer-status-line">
          <span>{modeLabel}</span>
          <span className="term-sep">·</span>
          <span>{obs.model}</span>
          <span className="term-sep">·</span>
          <span>{obs.tokenDisplay}</span>
          <span className="term-sep">·</span>
          <span>{obs.doneCount} done</span>
        </div>
        {obs.currentIntent ? (
          <div className="observer-current-intent">
            <span className="intent-badge">
              <span className="intent-bracket">「</span>
              {obs.currentIntent.badge}
              <span className="intent-bracket">」</span>
            </span>
            <span>{obs.currentIntent.title}</span>
          </div>
        ) : null}
      </div>

      <div className="term-pane-scroll term-pane-scroll-observer" ref={scrollRef}>
        {obs.empty ? (
          <div className="observer-empty">
            <p>Waiting for explorations...</p>
            <p className="term-dim observer-onboarding">
              Think on the left. This pane holds your conclusions.
              <br />
              Click here, then ? for shortcuts · c compact · i notes.
            </p>
          </div>
        ) : (
          <div className="observer-flow-surface">
            <div className="exploration-timeline">
              {obs.replayBanner ? (
                <p className="observer-replay-banner term-dim">
                  Replay from saved bundle.
                </p>
              ) : null}
              {explorations.map((exploration, index) => (
                <ExplorationCard
                  key={exploration.id}
                  exploration={exploration}
                  calmMode={calmMode}
                  isLatest={index === explorations.length - 1}
                  spinnerFrame={spinnerFrame}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="observer-commandbar">
        {showHelp ? (
          <div className="commandbar-help">
            <div>Keyboard shortcuts</div>
            <div className="term-dim">g timeline / flowchart · i notes · c calm · h export HTML · r regenerate</div>
          </div>
        ) : showNotesSidebar ? (
          <>
            <div className="term-dim cmd-static">
              {COMMAND_BAR_NOTES_ROW_1.replace('calm off', calmMode ? 'calm on' : 'calm off')}
            </div>
            <div className="term-dim cmd-static">{COMMAND_BAR_NOTES_ROW_2}</div>
          </>
        ) : (
          <>
            <button type="button" className="cmd-chip" onClick={onToggleHelp}>
              {COMMAND_BAR_ROW_1.replace('calm off', calmMode ? 'calm on' : 'calm off')}
            </button>
            <button type="button" className="cmd-chip" onClick={onToggleCalm}>
              {calmMode ? COMMAND_BAR_ROW_2.replace('calm off', 'calm on') : COMMAND_BAR_ROW_2}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function FlowTerminal({
  active,
  activeIndex,
  onSelect,
  showStrip = true,
  showResizeHint = true,
  onInteract,
}) {
  const [calmMode, setCalmMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [focusedPane, setFocusedPane] = useState('observer');
  const shellRef = useRef(null);
  const claudeScrollRef = useRef(null);
  const observerScrollRef = useRef(null);
  const notesScrollRef = useRef(null);

  const layout = active.layout ?? 'dual';
  const isNoteLayout = layout === 'note';
  const followScroll = active.id !== 'idle' && active.id !== 'replay' && active.id !== 'workspace';

  useEffect(() => {
    setCalmMode(Boolean(active.observer?.initialCalm));
    setShowHelp(Boolean(active.observer?.initialHelp));
    setFocusedPane('observer');
  }, [active.id, active.observer?.initialCalm, active.observer?.initialHelp]);

  useScrollFollow(claudeScrollRef, active.id, followScroll);
  useScrollFollow(observerScrollRef, active.id, followScroll);
  useScrollFollow(notesScrollRef, active.id, isNoteLayout);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (focusedPane !== 'observer') return;
      if (event.key === 'c') {
        event.preventDefault();
        setCalmMode((value) => !value);
      }
      if (event.key === '?' || (event.key === '/' && event.ctrlKey)) {
        event.preventDefault();
        setShowHelp((value) => !value);
      }
      if (event.key === 'g') {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedPane, onInteract]);

  const notesWidthPct = 28;
  const claudeWidth = isNoteLayout ? `${Math.min(TERMINAL_SPLIT_PCT, 40)}%` : `${TERMINAL_SPLIT_PCT}%`;

  return (
    <section className="flow-terminal" aria-label="GUI-Anything dual-pane terminal demo">
      <div
        key={active.id}
        className={`flow-terminal-grid ${isNoteLayout ? 'has-notes' : ''}`}
        ref={shellRef}
      >
        <div
          className={`flow-terminal-left ${focusedPane === 'claude' ? 'is-focused' : ''}`}
          style={{ width: claudeWidth }}
          onClick={() => {
            onInteract?.();
            setFocusedPane('claude');
          }}
          onFocus={() => setFocusedPane('claude')}
          role="region"
          aria-label="Claude Code pane"
          tabIndex={0}
        >
          <ClaudePane scenario={active} scrollRef={claudeScrollRef} />
        </div>

        <div
          className="flow-terminal-divider"
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={TERMINAL_SPLIT_PCT}
          tabIndex={-1}
        />

        <div
          className={`flow-terminal-right ${focusedPane === 'observer' ? 'is-focused' : ''}`}
          style={{
            width: isNoteLayout
              ? `${100 - Math.min(TERMINAL_SPLIT_PCT, 40) - notesWidthPct}%`
              : `${100 - TERMINAL_SPLIT_PCT}%`,
          }}
          onClick={() => {
            onInteract?.();
            setFocusedPane('observer');
          }}
          onFocus={() => setFocusedPane('observer')}
          role="region"
          aria-label="Flow Observer pane"
          tabIndex={0}
        >
          {layout === 'timeline' ? (
            <TimelinePane scenario={active} scrollRef={observerScrollRef} />
          ) : layout === 'workspace' ? (
            <WorkspacePane scenario={active} scrollRef={observerScrollRef} />
          ) : (
            <ObserverPane
              scenario={active}
              calmMode={calmMode}
              showHelp={showHelp}
              showNotesSidebar={isNoteLayout}
              scrollRef={observerScrollRef}
              onToggleCalm={() => setCalmMode((value) => !value)}
              onToggleHelp={() => setShowHelp((value) => !value)}
              onToggleMode={() => {}}
            />
          )}
        </div>

        {isNoteLayout ? (
          <>
            <div className="flow-terminal-divider flow-terminal-divider-notes" aria-hidden="true" />
            <div
              className={`flow-terminal-notes ${focusedPane === 'notes' ? 'is-focused' : ''}`}
              style={{ width: `${notesWidthPct}%` }}
              onClick={() => {
                onInteract?.();
                setFocusedPane('notes');
              }}
              onFocus={() => setFocusedPane('notes')}
              role="region"
              aria-label="Session notes pane"
              tabIndex={0}
            >
              <NotesPane notes={active.notes ?? []} scrollRef={notesScrollRef} />
            </div>
          </>
        ) : null}
      </div>

      {showStrip ? (
        <div className="flow-terminal-strip" role="tablist" aria-label="Demo scenarios">
          {terminalScenarios.map((scenario, index) => (
            <button
              className={index === activeIndex ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              key={scenario.id}
              onClick={() => {
                onInteract?.();
                onSelect(scenario);
              }}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      ) : null}

      {showResizeHint ? (
        <div className="flow-terminal-resize-hint">
          Scroll each pane · fixed 55/45 split
        </div>
      ) : null}
    </section>
  );
}
