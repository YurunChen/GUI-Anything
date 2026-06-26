/**
 * ABOUTME: OpenTUI-based Activity Tree TUI for scheme5 direct mode.
 * Supports both Activity Tree (connector lines) and Flow Timeline views.
 */

import { useKeyboard } from '@opentui/react';
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type { ReactNode } from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { parseClaudeJsonLine } from '../../data/protocol/jsonl-line-parser';
import type { ParseContext } from '../../domain/protocol';
import { ActivityTreeBuilder } from '../../domain/tree-builder';
import { startObserverStream } from '../../services/stream/observer';
import type { ActivityTree } from '../../domain/types';
import { treeNodes, TreeNode } from './tree-node';
import { FlowView } from './flow-view';
import {
  phaseIcons, formatElapsed, useTuiTheme, type ResolvedTuiTheme,
} from './theme';

/**
 * Mini progress bar: filled ▓ and empty ░ based on tool count.
 */
function MiniProgressBar({ value, max, width }: { value: number; max: number; width: number }): ReactNode {
  const theme = useTuiTheme();
  if (max === 0) return null;
  const pct = Math.min(value / max, 1);
  const filled = Math.floor(pct * width);
  const empty = width - filled;
  return (
    <text>
      <span fg={theme.semantic.success}>{'▓'.repeat(filled)}</span>
      <span fg={theme.semantic.label.quaternary}>{'░'.repeat(empty)}</span>
    </text>
  );
}

interface ActivityPanelProps {
  prompt: string;
  enableFlow?: boolean;
}

export function ActivityPanel({ prompt, enableFlow }: ActivityPanelProps): ReactNode {
  const theme = useTuiTheme();
  const [tree, setTree] = useState<ActivityTree | null>(null);
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [viewMode, setViewMode] = useState<'flow' | 'tree'>(enableFlow ? 'flow' : 'tree');

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed(prev => prev + 1000), 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize builder and start stream
  useEffect(() => {
    const sessionId = `tui_${Date.now()}`;
    const ctx: ParseContext = {
      seq: 0,
      source: { agent: 'claude', sessionId, model: undefined },
      traceId: `trace_${Date.now()}`
    };

    const builder = new ActivityTreeBuilder(prompt, {
      onChange: (t) => setTree({ ...t }),
      onComplete: () => setRunning(false),
      onError: () => {}
    });

    startObserverStream({
      prompt,
      onEvent: (line) => {
        const event = parseClaudeJsonLine(line, ctx);
        if (event) {
          builder.addEvent(event);
        }
      },
      onExit: () => {
        setRunning(false);
      }
    });
  }, [prompt]);

  // Keyboard: q quit, t toggle view
  useKeyboard(useCallback((key: { name: string }) => {
    if (key.name === 'q' || key.name === 'escape') process.exit(0);
    if (key.name === 't') setViewMode(prev => prev === 'flow' ? 'tree' : 'flow');
  }, []));

  const items = tree ? treeNodes(tree) : [];
  const fa = tree?.fileAccess ?? new Map();

  const icon = tree ? phaseIcons[tree.phase.current] ?? '⏸' : '⏸';
  const phase = tree ? tree.phase.current : 'idle';
  const phaseColor = resolvePhaseColor(phase, theme);
  const toolCalls = tree?.stats.toolCallCount ?? 0;
  const repeats = tree?.stats.repeatCount ?? 0;
  const timeStr = formatElapsed(elapsed);
  const nodeCount = tree ? tree.nodes.size : 0;

  // File heatmap
  const topFiles = useMemo(() => {
    if (!tree || tree.fileAccess.size === 0) return [];
    return [...tree.fileAccess.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => {
        const short = path.includes('/') ? path.split('/').pop()! : path;
        const bar = '█'.repeat(Math.min(count, 10));
        const warn = count >= 3 ? ' ⚠' : '';
        return `${short} ${bar} (${count})${warn}`;
      });
  }, [tree?.fileAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewLabel = viewMode === 'flow' ? 'Flow' : 'Tree';

  return (
    <box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: theme.semantic.fill.base }}>

      {/* ── Header ── */}
      <box style={{ width: '100%', backgroundColor: theme.semantic.fill.grouped, paddingLeft: 1, paddingRight: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
        <text>
          <span fg={running ? theme.semantic.info : theme.semantic.success}>
            {running ? '▶ Running' : '✓ Complete'}
          </span>
          <span fg={theme.semantic.label.quaternary}> │ </span>
          <span fg={phaseColor}>{icon} {phase.charAt(0).toUpperCase() + phase.slice(1)}</span>
          <span fg={theme.semantic.label.quaternary}> │ </span>
          <span fg={theme.semantic.label.secondary}>⏱ {timeStr}</span>
          {enableFlow && <span fg={theme.semantic.label.quaternary}> │ </span>}
          {enableFlow && <span fg={theme.semantic.tint}>[{viewLabel}]</span>}
        </text>
        <text fg={theme.semantic.label.tertiary}>
          Tools: {toolCalls}{'  '}Nodes: {nodeCount}
          {repeats > 0 ? <span fg={theme.semantic.warning}>  ⚡ Repeats: {repeats}</span> : ''}
        </text>
        <MiniProgressBar value={toolCalls} max={Math.max(toolCalls, 1)} width={8} />
      </box>

      {/* ── Alerts ── */}
      {tree && tree.alerts.length > 0 && (
        <box style={{
          width: '100%',
          backgroundColor: theme.semantic.fill.elevated,
          paddingLeft: 1, paddingRight: 1,
          border: true,
          borderColor: theme.semantic.warning,
        }}>
          <text>
            {tree.alerts.map((alert, i) => (
              <span key={i} fg={alert.severity === 'error' ? theme.semantic.destructive : theme.semantic.warning}>
                {i > 0 ? '  ' : ''}⚡ {alert.tool} repeated {alert.count} times
                {alert.severity === 'error' ? ' — possible loop!' : ''}
              </span>
            ))}
          </text>
        </box>
      )}

      {/* ── Content ── */}
      <box style={{ flexGrow: 1, flexDirection: 'column', border: true, borderColor: theme.semantic.separator }}>
        <scrollbox style={{ flexGrow: 1, padding: 1 }}>
          {items.length === 0 ? (
            <text fg={theme.semantic.label.tertiary}>Waiting for Claude to respond...</text>
          ) : viewMode === 'flow' ? (
            <FlowView tree={tree} running={running} elapsed={elapsed} />
          ) : (
            items.map(({ node, depth, isLast }) => (
              <TreeNode key={node.id} node={node} depth={depth} isLast={isLast} fileAccess={fa} />
            ))
          )}
        </scrollbox>
      </box>

      {/* ── Footer ── */}
      <box style={{ width: '100%', backgroundColor: theme.semantic.fill.grouped, paddingLeft: 1, paddingRight: 1 }}>
        {topFiles.length > 0 && (
          <text fg={theme.semantic.label.tertiary}>
            Files: {topFiles.join('  |  ')}
          </text>
        )}
        <text fg={theme.semantic.label.quaternary}>
          {enableFlow ? 't:toggle flow/tree ' : ''}q:quit
        </text>
      </box>
    </box>
  );
}

function resolvePhaseColor(phase: string, theme: ResolvedTuiTheme): string {
  switch (phase) {
    case 'exploring':
      return theme.semantic.info;
    case 'executing':
      return theme.semantic.warning;
    case 'verifying':
      return theme.semantic.success;
    default:
      return theme.semantic.label.tertiary;
  }
}

export async function renderTUI(prompt: string, enableFlow?: boolean): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
    enableMouseMovement: false,
  });
  const root = createRoot(renderer);
  root.render(<ActivityPanel prompt={prompt} enableFlow={enableFlow} />);
}

/** Alias for backward compatibility with opentui-observer.tsx */
export const renderObserver = renderTUI;
