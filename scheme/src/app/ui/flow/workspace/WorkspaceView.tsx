import type { ReactNode } from 'react';
import type {
  WorkspaceActivityView,
  WorkspaceTraceRow,
  WorkspaceTreeNode,
} from '../../../observer/view-model/workspace-activity';
import { useTuiTheme, type ResolvedTuiTheme } from '../../theme';
import { resolveWorkspaceActivityToken } from '../../themes/resolved-theme';
import { lineDisplayWidth, truncateFlowText } from '../../../../utils/flow-text';
import { getObserverMessages } from '../../i18n/observer-messages';
import { FlowLineGap } from '../flow-ui/FlowInsetGroup';

const MIN_TREE_ROW_LIMIT = 8;
const STACKED_TRACE_ROW_LIMIT = 3;
const TRACE_ROW_RESERVE = 5;

interface WorkspaceViewProps {
  view: WorkspaceActivityView;
  motionFrame: number;
  availableWidth: number;
  availableHeight?: number;
}

export interface WorkspaceViewLayout {
  stacked: boolean;
  contentWidth: number;
  treeWidth: number;
  traceWidth: number;
  treeRowLimit: number;
  traceRowLimit: number;
}

export interface WorkspaceTreeViewport {
  nodes: WorkspaceTreeNode[];
  start: number;
  total: number;
}

export function resolveWorkspaceViewLayout(
  availableWidth: number,
  availableHeight: number = 24,
): WorkspaceViewLayout {
  const contentWidth = Math.max(32, availableWidth - 4);
  const treeRowLimit = Math.max(MIN_TREE_ROW_LIMIT, availableHeight - TRACE_ROW_RESERVE);
  if (contentWidth < 66) {
    return {
      stacked: true,
      contentWidth,
      treeWidth: contentWidth,
      traceWidth: contentWidth,
      treeRowLimit,
      traceRowLimit: STACKED_TRACE_ROW_LIMIT,
    };
  }

  const treeWidth = Math.max(28, Math.floor(contentWidth * 0.58));
  const traceWidth = Math.max(28, contentWidth - treeWidth - 2);
  return {
    stacked: false,
    contentWidth,
    treeWidth,
    traceWidth,
    treeRowLimit,
    traceRowLimit: Math.max(STACKED_TRACE_ROW_LIMIT, availableHeight - 2),
  };
}

export function resolveWorkspaceTreeRowLimit(layout: WorkspaceViewLayout): number {
  return layout.treeRowLimit;
}

export function WorkspaceView({
  view,
  motionFrame,
  availableWidth,
  availableHeight,
}: WorkspaceViewProps): ReactNode {
  const tuiTheme = useTuiTheme();
  const workspaceTheme = tuiTheme.modes.workspace;
  const m = getObserverMessages();
  const layout = resolveWorkspaceViewLayout(availableWidth, availableHeight);
  if (view.tree.length <= 1 && view.trace.length === 0) {
    return (
      <box style={{ flexDirection: 'column' }}>
        <text fg={workspaceTheme.empty.fg}>{m.workspaceEmpty}</text>
      </box>
    );
  }

  const treeViewport = resolveWorkspaceTreeViewport(
    view.tree,
    resolveWorkspaceTreeRowLimit(layout),
  );
  const trace = view.trace.slice(-layout.traceRowLimit);

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      <text fg={workspaceTheme.title.fg}>{m.workspaceTitle.toUpperCase()}</text>
      {layout.stacked ? (
        <box style={{ width: '100%', flexDirection: 'column', marginTop: 1 }}>
          {renderTreeViewport(treeViewport, motionFrame, layout.treeWidth, tuiTheme)}
          <FlowLineGap />
          {renderTrace(trace, motionFrame, layout.traceWidth, tuiTheme)}
        </box>
      ) : (
        <box style={{ width: '100%', flexDirection: 'row', marginTop: 1 }}>
          {renderTreeViewport(treeViewport, motionFrame, layout.treeWidth, tuiTheme)}
          <box style={{ width: 2 }}>
            <text>{'  '}</text>
          </box>
          {renderTrace(trace, motionFrame, layout.traceWidth, tuiTheme)}
        </box>
      )}
      <FlowLineGap />
    </box>
  );
}

function renderTreeViewport(
  viewport: WorkspaceTreeViewport,
  motionFrame: number,
  width: number,
  tuiTheme: ResolvedTuiTheme,
): ReactNode {
  return (
    <box style={{ width, flexDirection: 'column' }}>
      {viewport.nodes.map((node) => renderTreeLine(
        node,
        motionFrame,
        width,
        tuiTheme,
      ))}
    </box>
  );
}

export function selectWorkspaceTreeNodes(
  nodes: WorkspaceTreeNode[],
  maxRows: number,
): WorkspaceTreeNode[] {
  return resolveWorkspaceTreeViewport(nodes, maxRows).nodes;
}

export function resolveWorkspaceTreeViewport(
  nodes: WorkspaceTreeNode[],
  maxRows: number,
): WorkspaceTreeViewport {
  const safeMax = Math.max(1, maxRows);
  if (nodes.length <= safeMax) {
    return { nodes, start: 0, total: nodes.length };
  }
  const focusIndex = findLastTreeIndex(nodes, (node) => node.isActive || node.isRecent);
  const start = focusIndex < safeMax ? 0 : focusIndex - safeMax + 1;
  return {
    nodes: nodes.slice(start, start + safeMax),
    start,
    total: nodes.length,
  };
}

function findLastTreeIndex(
  nodes: WorkspaceTreeNode[],
  predicate: (node: WorkspaceTreeNode) => boolean,
): number {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (predicate(nodes[index])) return index;
  }
  return -1;
}

function renderTrace(
  trace: WorkspaceTraceRow[],
  motionFrame: number,
  traceWidth: number,
  tuiTheme: ResolvedTuiTheme,
): ReactNode {
  const workspaceTheme = tuiTheme.modes.workspace;
  const m = getObserverMessages();
  return (
    <box style={{ flexGrow: 1, flexDirection: 'column' }}>
      <text fg={workspaceTheme.traceTitle.fg}>{m.workspaceTraceTitle.toUpperCase()}</text>
      {trace.length === 0 ? (
        <text fg={workspaceTheme.traceEmpty.fg}>{'No file activity yet'}</text>
      ) : (
        trace.map((row) => renderTraceLine(row, motionFrame, traceWidth, tuiTheme))
      )}
    </box>
  );
}

function renderTreeLine(
  node: WorkspaceTreeNode,
  motionFrame: number,
  width: number,
  tuiTheme: ResolvedTuiTheme,
): ReactNode {
  const prefix = renderTreePrefix(node);
  const workspaceTheme = tuiTheme.modes.workspace;
  const nodeToken = node.depth === 0
    ? workspaceTheme.tree.root
    : node.isDir
      ? workspaceTheme.tree.directory
      : workspaceTheme.tree.file;
  const marker = nodeToken.glyph;
  const cursor = node.isActive ? resolveActiveCursor(motionFrame) : '';
  const activityToken = (node.isActive || node.isRecent) && node.activity
    ? resolveWorkspaceActivityToken(
      tuiTheme,
      node.activity.action,
      node.activity.status,
      motionFrame,
    )
    : null;
  const activityBadge = activityToken ? ` ${activityToken.glyph}` : '';
  const name = truncateFlowText(
    node.name,
    Math.max(6, width
      - lineDisplayWidth(prefix)
      - lineDisplayWidth(marker)
      - lineDisplayWidth(cursor)
      - lineDisplayWidth(activityBadge)
      - 1),
  );
  const fg = node.isActive
    ? workspaceTheme.tree.active.fg
    : node.depth === 0
      ? workspaceTheme.tree.root.fg
      : node.isDir
      ? workspaceTheme.tree.directory.fg
      : node.isRecent
        ? workspaceTheme.tree.recent.fg
        : workspaceTheme.tree.file.fg;

  return (
    <text key={node.id} wrapMode="none">
      <span fg={workspaceTheme.tree.connectorFg}>{prefix}</span>
      <span fg={fg}>{marker}</span>
      {cursor ? <span fg={workspaceTheme.tree.active.fg}>{cursor}</span> : null}
      <span fg={fg}>{name}</span>
      {activityToken ? <span fg={activityToken.fg}>{activityBadge}</span> : null}
    </text>
  );
}

export function resolveActiveCursor(motionFrame: number): string {
  return motionFrame % 4 === 1 ? '◉ ' : '● ';
}

export function formatWorkspaceTreeLine(input: {
  node: WorkspaceTreeNode;
  marker: string;
  prefix: string;
  width: number;
  cursor?: string;
}): string {
  const cursor = input.cursor ?? (input.node.isActive ? '● ' : '');
  return truncateFlowText(
    `${input.prefix}${input.marker}${cursor}${input.node.name}`,
    input.width - 1,
  );
}

function renderTraceLine(
  row: WorkspaceTraceRow,
  motionFrame: number,
  width: number,
  tuiTheme: ResolvedTuiTheme,
): ReactNode {
  const token = resolveWorkspaceActivityToken(
    tuiTheme,
    row.action,
    row.status,
    motionFrame,
  );
  const glyph = token.glyph;
  const action = row.action.padEnd(6, ' ');
  const text = truncateFlowText(`${glyph} ${action} ${row.summary}`, width - 1);

  return (
    <text key={row.id} wrapMode="none" fg={token.fg}>
      {text}
    </text>
  );
}

function renderTreePrefix(node: WorkspaceTreeNode): string {
  if (node.depth === 0) return '';
  const ancestors = node.connector
    .map((ancestorIsLast) => ancestorIsLast ? '    ' : '│   ')
    .join('');
  return `${ancestors}${node.isLast ? '└── ' : '├── '}`;
}
