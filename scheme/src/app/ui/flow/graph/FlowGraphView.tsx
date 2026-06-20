import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import type {
  FlowGraphEdgeKind,
  FlowGraphNode,
  FlowGraphSnapshot,
  SessionScopedId,
} from '../../../../data/protocol/observer-protocol';
import { getObserverMessages, resolveObserverLocale } from '../../i18n/observer-messages';
import { flowSpacing } from '../flow-ui/flow-spacing';
import { pulseFrames, useThemeVersion } from '../../theme';
import { buildGraphTheme, type GraphTheme } from './graph-theme';
import { FlowGraphNodeBody } from './FlowGraphNodeBody';
import { buildTreeLevels, buildTreeRows, type TreeDataNode, type TreeRow } from './TreeView';
import {
  resolveGraphNodeChromeParts,
  resolveRailRowIndent,
  formatStackConnector,
} from './flow-graph-node-chrome';
import {
  GRAPH_LEVEL_GAP,
  resolveCardInnerWidth,
  resolveFlowGraphLayoutMode,
  resolveNodeCardOuterWidth,
  resolveStackCardInnerWidth,
} from './flow-graph-layout';

interface FlowGraphViewProps {
  snapshot: FlowGraphSnapshot;
  availableWidth: number;
}

interface FlowTreeMeta {
  flowNode: FlowGraphNode;
  incomingKind?: FlowGraphEdgeKind;
}

const centeredRowStyle = {
  width: '100%' as const,
  flexDirection: 'row' as const,
  justifyContent: 'center' as const,
};

const centeredColumnStyle = {
  width: '100%' as const,
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
};

export const FlowGraphView = memo(function FlowGraphView(props: FlowGraphViewProps): ReactNode {
  const { snapshot, availableWidth } = props;
  const themeVersion = useThemeVersion();
  const graphTheme = useMemo(() => buildGraphTheme(), [themeVersion]);
  const [pulseFrameIndex, setPulseFrameIndex] = useState(0);
  const treeData = useMemo(() => buildFlowTreeData(snapshot), [snapshot]);
  const levels = useMemo(
    () => applyNarrowLevelCollapse(buildTreeLevels(treeData), availableWidth),
    [treeData, availableWidth],
  );
  const layoutMode = useMemo(
    () => resolveFlowGraphLayoutMode(availableWidth, levels),
    [availableWidth, levels],
  );
  const hasAnimatedNode = snapshot.nodes.some((node) => getNodeRuntimePhase(node) !== 'stable');

  useEffect(() => {
    if (!hasAnimatedNode) return;
    const timer = setInterval(() => {
      setPulseFrameIndex((prev) => (prev + 1) % pulseFrames.length);
    }, 180);
    return () => clearInterval(timer);
  }, [hasAnimatedNode]);

  if (snapshot.nodes.length === 0) {
    const m = getObserverMessages();
    return (
      <box style={centeredColumnStyle}>
        <text fg={graphTheme.color.muted}>{m.flowchartEmpty}</text>
      </box>
    );
  }

  if (layoutMode === 'rail') {
    const rows = buildTreeRows(treeData);
    return (
      <box
        style={{
          width: '100%',
          flexDirection: 'column',
          paddingLeft: flowSpacing.contentPadX,
          paddingRight: flowSpacing.contentPadX,
        }}
      >
        {rows.map((row, index) => renderRailRow(
          graphTheme,
          row,
          snapshot.focusNodeId,
          index === 0 ? undefined : rows[index - 1]?.depth,
          index === 0,
        ))}
      </box>
    );
  }

  if (layoutMode === 'stack') {
    const stackInner = resolveStackCardInnerWidth(availableWidth);
    const stackOuter = resolveNodeCardOuterWidth(stackInner);
    return (
      <box style={centeredColumnStyle}>
        {levels.map((level, levelIndex) => (
          <box key={`stack_${levelIndex}`} style={{ width: '100%', flexDirection: 'column', marginBottom: 0 }}>
            {levelIndex > 0 && (
              <box style={{ ...centeredColumnStyle, marginTop: 0, marginBottom: 0 }}>
                {renderVerticalConnector(
                  graphTheme,
                  level[0]?.meta?.incomingKind,
                )}
              </box>
            )}
            <box style={{ ...centeredRowStyle, marginTop: levelIndex > 0 ? 0 : 0, marginBottom: 1 }}>
              {level.map((node) => renderNodeCard(
                graphTheme,
                node,
                snapshot.focusNodeId,
                stackOuter,
                pulseFrameIndex,
              ))}
            </box>
          </box>
        ))}
      </box>
    );
  }

  return (
    <box style={centeredColumnStyle}>
      {levels.map((level, levelIndex) => (
        <box key={`grid_${levelIndex}`} style={{ width: '100%', flexDirection: 'column', marginBottom: 1 }}>
          {levelIndex > 0 && (
            <box style={{ ...centeredRowStyle, marginBottom: 0 }}>
              {renderGridConnectorRow(graphTheme, level, availableWidth)}
            </box>
          )}
          <box style={centeredRowStyle}>
            {renderGridNodeRow(
              graphTheme,
              level,
              snapshot.focusNodeId,
              availableWidth,
              pulseFrameIndex,
            )}
          </box>
        </box>
      ))}
    </box>
  );
});

function renderGridNodeRow(
  theme: GraphTheme,
  level: TreeDataNode<FlowTreeMeta>[],
  focusNodeId: SessionScopedId | undefined,
  availableWidth: number,
  pulseFrameIndex: number,
): ReactNode[] {
  const inner = resolveCardInnerWidth(availableWidth, level.length);
  const slotWidth = resolveNodeCardOuterWidth(inner);
  return level.map((node, idx) => (
    <box
      key={node.id}
      style={{
        width: slotWidth,
        flexDirection: 'row',
        justifyContent: 'center',
        marginRight: idx < level.length - 1 ? GRAPH_LEVEL_GAP : 0,
      }}
    >
      {renderNodeCard(
        theme,
        node,
        focusNodeId,
        slotWidth,
        pulseFrameIndex,
      )}
    </box>
  ));
}

function renderGridConnectorRow(
  theme: GraphTheme,
  level: TreeDataNode<FlowTreeMeta>[],
  availableWidth: number,
): ReactNode[] {
  const inner = resolveCardInnerWidth(availableWidth, level.length);
  const slotWidth = resolveNodeCardOuterWidth(inner);
  return level.map((node, idx) => (
    <box
      key={`connector_${node.id}`}
      style={{
        width: slotWidth,
        flexDirection: 'row',
        justifyContent: 'center',
        marginRight: idx < level.length - 1 ? GRAPH_LEVEL_GAP : 0,
      }}
    >
      <text fg={connectorColor(theme, node.meta?.incomingKind)}>
        {renderVerticalConnectorText(theme, node.meta?.incomingKind)}
      </text>
    </box>
  ));
}

export function buildFlowTreeData(snapshot: FlowGraphSnapshot): TreeDataNode<FlowTreeMeta>[] {
  const indexById = new Map(snapshot.nodes.map((node, index) => [node.id, index]));
  const childrenById = new Map<SessionScopedId, Array<{ to: SessionScopedId; kind: FlowGraphEdgeKind }>>();
  const incomingById = new Map<SessionScopedId, FlowGraphEdgeKind>();
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const inDegree = new Map<SessionScopedId, number>();

  for (const node of snapshot.nodes) {
    childrenById.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  for (const edge of snapshot.edges) {
    const children = childrenById.get(edge.from);
    if (children) children.push({ to: edge.to, kind: edge.kind });
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    if (!incomingById.has(edge.to)) incomingById.set(edge.to, edge.kind);
  }
  for (const [id, children] of childrenById.entries()) {
    children.sort((a, b) => (indexById.get(a.to) ?? 0) - (indexById.get(b.to) ?? 0));
    childrenById.set(id, children);
  }

  const roots = snapshot.nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  if (roots.length === 0 && snapshot.nodes[0]) roots.push(snapshot.nodes[0].id);

  const trees: TreeDataNode<FlowTreeMeta>[] = [];
  const visited = new Set<SessionScopedId>();

  const buildNode = (
    id: SessionScopedId,
    incomingKind: FlowGraphEdgeKind | undefined,
  ): TreeDataNode<FlowTreeMeta> | null => {
    if (visited.has(id)) return null;
    visited.add(id);
    const node = nodeById.get(id);
    if (!node) return null;
    const children = childrenById.get(id) ?? [];
    const treeChildren: TreeDataNode<FlowTreeMeta>[] = [];
    for (const child of children) {
      const treeChild = buildNode(child.to, child.kind);
      if (treeChild) treeChildren.push(treeChild);
    }
    return {
      id: node.id,
      text: node.label,
      children: treeChildren,
      meta: {
        flowNode: node,
        incomingKind,
      },
    };
  };

  for (const rootId of roots) {
    const tree = buildNode(rootId, incomingById.get(rootId));
    if (tree) trees.push(tree);
  }
  for (const node of snapshot.nodes) {
    if (visited.has(node.id)) continue;
    const tree = buildNode(node.id, incomingById.get(node.id));
    if (tree) trees.push(tree);
  }

  return trees;
}

function edgeColor(theme: GraphTheme, kind: FlowGraphEdgeKind): string {
  if (kind === 'fork_repair') return theme.color.branchRepair;
  if (kind === 'fork_alternative') return theme.color.branchAlternative;
  if (kind === 'merge') return theme.color.merge;
  if (kind === 'dead_end') return theme.color.deadEnd;
  return theme.color.trunk;
}

function renderNodeCard(
  theme: GraphTheme,
  node: TreeDataNode<FlowTreeMeta>,
  focusNodeId: SessionScopedId | undefined,
  cardOuterWidth: number,
  pulseFrameIndex: number,
): ReactNode {
  const flowNode = node.meta?.flowNode;
  if (!flowNode) {
    return (
      <box
        key={node.id}
        style={{
          width: cardOuterWidth,
          border: true,
          borderColor: theme.color.rail,
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'column',
        }}
      >
        <text fg={theme.color.muted} wrapMode="word">{node.text}</text>
      </box>
    );
  }

  const locale = resolveObserverLocale();
  const isFocus = focusNodeId === flowNode.id;
  const parts = resolveGraphNodeChromeParts(flowNode, locale);
  const runtimePhase = getNodeRuntimePhase(flowNode);
  const branchColor = node.meta?.incomingKind ? edgeColor(theme, node.meta.incomingKind) : theme.color.trunk;
  const animatedBorderColor = runtimePhase !== 'stable'
    ? (pulseFrameIndex % 2 === 0
      ? (runtimePhase === 'running' ? theme.color.statusRunning : theme.color.branchAlternative)
      : theme.color.focusLabel)
    : branchColor;

  return (
    <box
      key={flowNode.id}
      style={{
        width: cardOuterWidth,
        border: true,
        borderColor: isFocus ? theme.color.focusLabel : animatedBorderColor,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
        flexDirection: 'column',
      }}
    >
      <FlowGraphNodeBody
        parts={parts}
        isFocus={isFocus}
        theme={theme}
      />
    </box>
  );
}

function renderRailRow(
  theme: GraphTheme,
  row: TreeRow<FlowTreeMeta>,
  focusNodeId: SessionScopedId | undefined,
  priorDepth: number | undefined,
  isFirstRow: boolean,
): ReactNode {
  const locale = resolveObserverLocale();
  const flowNode = row.node.meta?.flowNode;
  const isFocus = flowNode && focusNodeId === flowNode.id;
  const indent = resolveRailRowIndent(row.depth);
  const gapBefore = isFirstRow
    ? 0
    : priorDepth !== undefined && row.depth === 0 && priorDepth > 0
      ? flowSpacing.graphNodeGap + 1
      : flowSpacing.graphNodeGap;

  if (!flowNode) {
    const hasConnector = row.connectorPrefix.length > 0;
    return (
      <box
        key={row.node.id}
        style={{
          width: '100%',
          flexDirection: 'row',
          marginTop: gapBefore,
          paddingLeft: hasConnector ? 0 : indent,
        }}
      >
        {hasConnector && renderConnectorPrefix(theme, row.connectorPrefix, row.node.meta?.incomingKind)}
        <text fg={theme.color.muted} wrapMode="word">{row.node.text}</text>
      </box>
    );
  }

  const parts = resolveGraphNodeChromeParts(flowNode, locale);
  const incomingKind = row.node.meta?.incomingKind;
  const hasConnector = row.connectorPrefix.length > 0;

  return (
    <box
      key={row.node.id}
      style={{
        width: '100%',
        flexDirection: 'row',
        marginTop: gapBefore,
        paddingLeft: hasConnector ? 0 : indent,
      }}
    >
      {hasConnector && renderConnectorPrefix(theme, row.connectorPrefix, incomingKind)}
      <box style={{ flexDirection: 'column', flexGrow: 1 }}>
        <FlowGraphNodeBody parts={parts} isFocus={!!isFocus} theme={theme} />
      </box>
    </box>
  );
}

function renderConnectorPrefix(
  theme: GraphTheme,
  prefix: string,
  kind: FlowGraphEdgeKind | undefined,
): ReactNode {
  return (
    <text fg={connectorColor(theme, kind)}>{prefix}</text>
  );
}

function renderVerticalConnectorText(
  theme: GraphTheme,
  _kind: FlowGraphEdgeKind | undefined,
): string {
  return formatStackConnector(theme.chars.trunk, theme.chars.down);
}

function renderVerticalConnector(
  theme: GraphTheme,
  kind: FlowGraphEdgeKind | undefined,
): ReactNode {
  const fg = connectorColor(theme, kind);
  return <text fg={fg}>{renderVerticalConnectorText(theme, kind)}</text>;
}

function connectorColor(theme: GraphTheme, kind: FlowGraphEdgeKind | undefined): string {
  return kind ? edgeColor(theme, kind) : theme.color.rail;
}

function applyNarrowLevelCollapse(
  levels: TreeDataNode<FlowTreeMeta>[][],
  availableWidth: number,
): TreeDataNode<FlowTreeMeta>[][] {
  if (availableWidth >= 92) return levels;
  return levels.map((level, levelIndex) => {
    if (levelIndex === 0) return level;
    if (level.length <= 2) return level;
    const keep = Math.max(1, Math.floor(availableWidth / 36));
    const kept = level.slice(0, keep);
    const hidden = level.length - kept.length;
    if (hidden <= 0) return kept;
    return [
      ...kept,
      {
        id: `level_${levelIndex}_collapsed`,
        text: `+${hidden} branches`,
        children: [],
      },
    ];
  });
}

function getNodeRuntimePhase(node: FlowGraphNode): 'running' | 'generating' | 'stable' {
  const normalizedLabel = node.label.trim().toLowerCase();
  if (node.status === 'running' || normalizedLabel === 'running') return 'running';
  if (normalizedLabel === 'generating') return 'generating';
  return 'stable';
}
