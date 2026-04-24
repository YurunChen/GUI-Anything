import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type { ReactNode } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useKeyboard } from '@opentui/react';
import type { ActivityTree } from '../../core/types';
import { treeNodes, TreeNode } from './tree-node';
import { colors, phaseIcons, phaseColors } from './theme';
import { useViewMode } from './hooks';
import {
  findLatestSession,
  parseJsonlFile,
  buildTreeFromEvents,
  extractExplorationsFromSession,
  extractSessionStats,
  type Exploration
} from '../../runtime/posthoc';
import {
  generateExplorationSummaryAI,
  generatePotentialDirectionsAI,
  type PotentialDirection,
  type DirectionExplorationInput,
  type ExplorationHistoryContext,
} from '../../core/flow-summaries';
import { LiveObserverFlowBody } from './live-observer-flow-body';
import { createEmptySessionJsonlCache, refreshSessionJsonlCache } from './live-observer-session-read';

const OBSERVER_POLL_MS = 500;

/**
 * Live observer: polls the latest session JSONL and renders a real-time
 * activity tree / flow timeline. Runs alongside Claude interactive.
 * FLOW_PROJECT_DIR env var overrides cwd for session discovery.
 */
function safeExit(): void {
  // Restore terminal from alternate screen/raw-like UI state before exiting.
  const restoreSeq = '\u001b[?25h\u001b[?1049l\u001b[?1000l\u001b[?1002l\u001b[?1003l\u001b[?1006l\u001b[?2004l\u001b[0m';
  process.stdout.write(restoreSeq);
  process.exit(0);
}

export function LiveObserverView(): ReactNode {
  const { viewMode, toggleViewMode } = useViewMode('flow');
  const [tree, setTree] = useState<ActivityTree | null>(null);
  const [sessionPath, setSessionPath] = useState('');
  const [explorations, setExplorations] = useState<Exploration[]>([]);
  const [explorationSummaries, setExplorationSummaries] = useState<Record<string, string>>({});
  const [runtimeModel, setRuntimeModel] = useState('unknown');
  const [tokenDisplay, setTokenDisplay] = useState('N/A');
  const [summaryModel, setSummaryModel] = useState((process.env.CLAUDE_MODEL || '').trim());
  const [summaryModelDraft, setSummaryModelDraft] = useState((process.env.CLAUDE_MODEL || '').trim());
  const [modelInputFocused, setModelInputFocused] = useState(false);
  const [potentialDirections, setPotentialDirections] = useState<PotentialDirection[]>([]);
  const [directionsStatus, setDirectionsStatus] = useState<'idle' | 'generating' | 'ready' | 'insufficient' | 'error'>('idle');
  const [directionsMessage, setDirectionsMessage] = useState('');
  const [cwd] = useState(process.env.FLOW_PROJECT_DIR || process.cwd());
  const pendingSummaryRef = useRef<Set<string>>(new Set());
  const sessionJsonlCache = useRef(createEmptySessionJsonlCache());

  // Poll session JSONL frequently to reduce observer lag.
  useEffect(() => {
    const tick = () => {
      const sessionPathResult = findLatestSession(cwd);
      if (!sessionPathResult) return;

      const cache = sessionJsonlCache.current;
      if (!refreshSessionJsonlCache(sessionPathResult, cache)) {
        return;
      }

      const sessionContent = cache.content;
      const events = parseJsonlFile(sessionPathResult, undefined, sessionContent);
      const stats = extractSessionStats(sessionPathResult, sessionContent);
      const nextExplorations = extractExplorationsFromSession(sessionPathResult, sessionContent);
      const nextTree = buildTreeFromEvents(events, '');
      const total = stats.inputTokens + stats.outputTokens + stats.cacheReadTokens + stats.cacheWriteTokens;
      let nextTokenDisplay = '--';
      if (stats.hasPositiveUsage) {
        nextTokenDisplay = total.toLocaleString();
      } else if (stats.hasUsageField) {
        nextTokenDisplay = 'N/A';
      }
      const modelFromStream = [...events]
        .reverse()
        .find((event) => {
          const model = event.source?.model;
          return typeof model === 'string' && model.length > 0 && model !== 'unknown-model';
        })
        ?.source?.model;
      const nextRuntimeModel = modelFromStream || 'unknown';

      // Commit this polling tick in one place and skip no-op updates.
      setSessionPath((prev) => (prev === sessionPathResult ? prev : sessionPathResult));
      setExplorations(nextExplorations);
      setTree(nextTree);
      setTokenDisplay((prev) => (prev === nextTokenDisplay ? prev : nextTokenDisplay));
      setRuntimeModel((prev) => (prev === nextRuntimeModel ? prev : nextRuntimeModel));
    };

    tick();
    const interval = setInterval(tick, OBSERVER_POLL_MS);
    return () => clearInterval(interval);
  }, [cwd]);

  useEffect(() => {
    for (const exploration of explorations) {
      if (exploration.status !== 'complete') continue;
      if (explorationSummaries[exploration.id]) continue;
      if (pendingSummaryRef.current.has(exploration.id)) continue;
      if (exploration.nodes.length === 0) continue;
      const idx = explorations.findIndex((item) => item.id === exploration.id);
      const history: ExplorationHistoryContext[] = explorations
        .slice(Math.max(0, idx - 3), idx)
        .filter((item) => item.status === 'complete' || item.status === 'interrupted')
        .map((item) => ({
          question: item.question,
          summary: explorationSummaries[item.id],
          toolCount: item.nodes.filter((node) => node.type === 'tool').length,
          errorCount: item.nodes.filter((node) => node.type === 'error' || node.status === 'error').length,
          status: item.status === 'interrupted' ? 'interrupted' : 'complete',
        }));
      pendingSummaryRef.current.add(exploration.id);
      const id = exploration.id;
      generateExplorationSummaryAI(exploration.question, exploration.nodes, history, summaryModel || undefined)
        .then((summary) => {
          setExplorationSummaries((prev) => ({ ...prev, [id]: summary }));
        })
        .catch(() => {
          setExplorationSummaries((prev) => ({
            ...prev,
            [id]: '（摘要生成失败，可检查模型与网络后重试）',
          }));
        })
        .finally(() => {
          // Defer clearing pending until after React commits summaries; sync .finally
          // otherwise runs before paint and the flow UI briefly shows "pending" with no motion.
          setTimeout(() => {
            pendingSummaryRef.current.delete(id);
          }, 0);
        });
    }
  }, [explorations, explorationSummaries, summaryModel]);

  const checkDirectionSufficiency = useCallback((completed: Exploration[]): string | null => {
    if (completed.length < 2) {
      return '当前证据不足：至少需要2轮已完成探索。';
    }
    const hasEvidence = completed.some((exp) =>
      exp.nodes.some((node) => node.type === 'tool' || node.type === 'response' || node.type === 'result')
    );
    if (!hasEvidence) {
      return '当前证据不足：尚未观察到有效工具或响应输出。';
    }
    const greetingOnly = completed.every((exp) => /^(hi|hello|hey|你好|您好|嗨)\s*[!,.，。！？]*$/i.test(exp.question.trim()));
    if (greetingOnly) {
      return '当前证据不足：探索内容仍以问候/闲聊为主。';
    }
    return null;
  }, []);

  const triggerPotentialDirections = useCallback(() => {
    const completed = explorations.filter((exp) => exp.status === 'complete');
    const insufficiency = checkDirectionSufficiency(completed);
    if (insufficiency) {
      setPotentialDirections([]);
      setDirectionsStatus('insufficient');
      setDirectionsMessage(insufficiency);
      return;
    }

    const context: DirectionExplorationInput[] = completed.slice(-5).map((exp) => ({
      id: exp.id,
      question: exp.question,
      summary: explorationSummaries[exp.id],
      toolCount: exp.nodes.filter((node) => node.type === 'tool').length,
      errorCount: exp.nodes.filter((node) => node.type === 'error' || node.status === 'error').length,
    }));

    setDirectionsStatus('generating');
    setDirectionsMessage('');
    generatePotentialDirectionsAI(runtimeModel, context, summaryModel || undefined)
      .then((result) => {
        if (result.status === 'insufficient') {
          setPotentialDirections([]);
          setDirectionsStatus('insufficient');
          setDirectionsMessage(result.message || '当前证据不足，请继续补充探索。');
          return;
        }
        setPotentialDirections(result.directions);
        setDirectionsStatus('ready');
        setDirectionsMessage('');
      })
      .catch(() => {
        setPotentialDirections([]);
        setDirectionsStatus('error');
        setDirectionsMessage('方向建议生成失败，请稍后重试。');
      });
  }, [checkDirectionSufficiency, explorations, explorationSummaries, runtimeModel, summaryModel]);

  useKeyboard(useCallback((key: { name: string }) => {
    if (modelInputFocused) {
      if (key.name === 'escape') {
        setSummaryModelDraft(summaryModel);
        setModelInputFocused(false);
      }
      return;
    }
    if (key.name === 'escape') safeExit();
    if (key.name === 'q') safeExit();
    if (key.name === 't') toggleViewMode();
    if (key.name === 'g') triggerPotentialDirections();
  }, [modelInputFocused, summaryModel, toggleViewMode, triggerPotentialDirections]));

  const items = tree ? treeNodes(tree) : [];
  const fa = tree?.fileAccess ?? new Map();
  const icon = tree ? phaseIcons[tree.phase.current] ?? '⏸' : '⏳';
  const phase = tree ? tree.phase.current : 'waiting';
  const phaseColor = tree ? phaseColors[tree.phase.current] ?? colors.fg.muted : colors.fg.muted;
  const viewLabel = viewMode === 'flow' ? 'Flow' : 'Tree';
  const completedCount = explorations.filter((exploration) => exploration.status === 'complete').length;
  // Error means unexpected turn interruption, not ordinary tool failures.
  const interruptionErrorCount = explorations.filter(
    (exploration) => (exploration.errorCounts.system + exploration.errorCounts.result) > 0
  ).length;

  return (
    <box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <box style={{ width: '100%', backgroundColor: colors.bg.secondary, paddingLeft: 1, paddingRight: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
        <text>
          <span fg={phaseColor}>{icon} {phase}</span>
          <span fg={colors.fg.dim}>  │ </span>
          <span fg={colors.status.success}>{`Completed: ${completedCount}`}</span>
          <span fg={colors.fg.dim}>  </span>
          <span fg={interruptionErrorCount > 0 ? colors.status.error : colors.fg.secondary}>
            {`Error: ${interruptionErrorCount}`}
          </span>
          <span fg={colors.fg.dim}>  │ </span>
          <span fg={colors.fg.secondary}>{`Runtime model: ${runtimeModel}`}</span>
          <span fg={colors.fg.dim}>  │ </span>
          <span fg={colors.status.warning}>{`Total tokens: ${tokenDisplay}`}</span>
          <span fg={colors.fg.dim}>  │ </span>
          <span fg={colors.accent.primary}>[{viewLabel}]</span>
        </text>
      </box>

      {/* Session info */}
      <box style={{ width: '100%', backgroundColor: colors.bg.secondary, paddingLeft: 1 }}>
        <text fg={colors.fg.dim}>
          {sessionPath ? sessionPath.split('/').slice(-1)[0].slice(0, 50) : 'No session file found'}
        </text>
      </box>

      {/* Activity tree with scroll */}
      <box style={{ flexGrow: 1, flexDirection: 'column', border: true, borderColor: colors.border.normal }}>
        <scrollbox style={{ flexGrow: 1, padding: 1, stickyScroll: true, stickyStart: 'bottom', viewportCulling: false }}>
          {viewMode === 'flow' ? (
            <LiveObserverFlowBody
              explorations={explorations}
              summaries={explorationSummaries}
              pendingSummaryRef={pendingSummaryRef}
              directionsStatus={directionsStatus}
              directionsMessage={directionsMessage}
              potentialDirections={potentialDirections}
            />
          ) : items.length === 0 ? (
            <text fg={colors.fg.muted}>Waiting for Claude activity...</text>
          ) : (
            items.map(({ node, depth, isLast }) => (
              <TreeNode key={node.id} node={node} depth={depth} isLast={isLast} fileAccess={fa} />
            ))
          )}
        </scrollbox>
      </box>

      {/* Footer: file access heatmap */}
      {tree && tree.fileAccess.size > 0 && (
        <box style={{ width: '100%', backgroundColor: colors.bg.tertiary, paddingLeft: 1, paddingRight: 1 }}>
          <text fg={colors.fg.muted}>
            {'  '}
            {[...tree.fileAccess.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([path, count]) => {
                const short = path.includes('/') ? path.split('/').pop()! : path;
                const warn = count >= 3 ? ' ⚠' : '';
                return `${short}: ${count}${warn}`;
              })
              .join('  |  ')}
          </text>
        </box>
      )}

      <box style={{ width: '100%', backgroundColor: colors.bg.tertiary, paddingLeft: 1, paddingRight: 1 }}>
        <box
          title={`Summary model override (${summaryModel || 'default'})`}
          style={{
            width: '100%',
            height: 3,
            border: true,
            borderColor: modelInputFocused ? colors.accent.secondary : colors.border.normal,
            marginBottom: 1,
          }}
          onMouseDown={() => setModelInputFocused(true)}
        >
          <input
            focused={modelInputFocused}
            value={summaryModelDraft}
            placeholder="sonnet / opus"
            onInput={(value) => {
              setSummaryModelDraft(value);
            }}
            onSubmit={(value) => {
              const next = value.trim();
              setSummaryModel(next);
              setSummaryModelDraft(next);
              setModelInputFocused(false);
            }}
            style={{
              backgroundColor: colors.bg.secondary,
              textColor: colors.fg.primary,
            }}
          />
        </box>
      </box>

      {/* Footer: shortcuts */}
      <box
        style={{
          width: '100%',
          backgroundColor: colors.bg.tertiary,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text fg={colors.fg.dim}>hotkeys: t toggle | g directions | q quit</text>
      </box>
    </box>
  );
}

export async function renderLiveObserver(_cwd?: string): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  const root = createRoot(renderer);
  root.render(<LiveObserverView />);
}
