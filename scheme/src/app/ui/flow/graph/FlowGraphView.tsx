import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import type {
  FlowGraphEdgeKind,
  FlowGraphNode,
  FlowGraphSnapshot,
  SessionScopedId,
} from '../../../../data/protocol/observer-protocol';
import { lineDisplayWidth, wrapDisplayLines } from '../summary-layout';
import { pulseFrames } from '../../theme';
import { graphTheme } from './graph-theme';
import { buildTreeLevels, type TreeDataNode } from './TreeView';

interface FlowGraphViewProps {
  snapshot: FlowGraphSnapshot;
  availableWidth: number;
}

interface FlowTreeMeta {
  flowNode: FlowGraphNode;
  incomingKind?: FlowGraphEdgeKind;
}

export const FlowGraphView = memo(function FlowGraphView(props: FlowGraphViewProps): ReactNode {
  const { snapshot, availableWidth } = props;
  const [pulseFrameIndex, setPulseFrameIndex] = useState(0);
  const treeData = useMemo(() => buildFlowTreeData(snapshot), [snapshot]);
  const levels = useMemo(
    () => applyNarrowLevelCollapse(buildTreeLevels(treeData), availableWidth),
    [treeData, availableWidth],
  );
  const hasAnimatedNode = snapshot.nodes.some((node) => getNodeRuntimePhase(node) !== 'stable');

  useEffect(() => {
    if (!hasAnimatedNode) return;
    const timer = setInterval(() => {
      setPulseFrameIndex((prev) => (prev + 1) % pulseFrames.length);
    }, 180);
    return () => clearInterval(timer);
  }, [hasAnimatedNode]);

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {levels.map((level, levelIndex) => (
        <box key={`level_${levelIndex}`} style={{ width: '100%', flexDirection: 'column' }}>
          {levelIndex > 0 && (
            <box style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-around', marginBottom: 0 }}>
              {level.map((node, idx) => (
                <text key={`connector_${levelIndex}_${idx}`} fg={connectorColor(node.meta?.incomingKind)}>
                  {'│'}
                </text>
              ))}
            </box>
          )}
          <box style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-around', marginBottom: 1 }}>
            {level.map((node) => renderNodeCard(node, snapshot.focusNodeId, availableWidth, pulseFrameIndex))}
          </box>
        </box>
      ))}
    </box>
  );
});

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

function edgeColor(kind: FlowGraphEdgeKind): string {
  if (kind === 'fork_repair') return graphTheme.color.branchRepair;
  if (kind === 'fork_alternative') return graphTheme.color.branchAlternative;
  if (kind === 'merge') return graphTheme.color.merge;
  if (kind === 'dead_end') return graphTheme.color.deadEnd;
  return graphTheme.color.trunk;
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1))}…`;
}

function renderNodeCard(
  node: TreeDataNode<FlowTreeMeta>,
  focusNodeId: SessionScopedId | undefined,
  availableWidth: number,
  pulseFrameIndex: number,
): ReactNode {
  const flowNode = node.meta?.flowNode;
  if (!flowNode) {
    return (
      <box
        key={node.id}
        style={{
          border: true,
          borderColor: graphTheme.color.rail,
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'column',
          marginRight: 1,
        }}
      >
        <text fg={graphTheme.color.muted}>{node.text}</text>
      </box>
    );
  }
  const isFocus = focusNodeId === flowNode.id;
  const runtimePhase = getNodeRuntimePhase(flowNode);
  const branchColor = node.meta?.incomingKind ? edgeColor(node.meta.incomingKind) : graphTheme.color.trunk;
  const maxCols = Math.max(12, Math.floor(availableWidth / 3) - 6);
  const title = runtimePhase === 'running'
    ? `${pulseFrames[pulseFrameIndex]} running`
    : runtimePhase === 'generating'
      ? `${generatingFrames[pulseFrameIndex % generatingFrames.length]} generating`
      : truncate(flowNode.label, maxCols);
  const cardInnerWidth = Math.max(12, Math.min(26, maxCols));
  const wrappedTitleLines = fitTitleLines(title, cardInnerWidth);
  const animatedBorderColor = runtimePhase !== 'stable'
    ? (pulseFrameIndex % 2 === 0
      ? runtimePhase === 'running' ? graphTheme.color.statusRunning : graphTheme.color.branchAlternative
      : graphTheme.color.focusLabel)
    : branchColor;
  return (
    <box
      key={node.id}
      style={{
        border: true,
        borderColor: isFocus ? graphTheme.color.focusLabel : animatedBorderColor,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: 'column',
        marginRight: 1,
        minWidth: cardInnerWidth + 2,
      }}
    >
      {wrappedTitleLines.map((line, idx) => (
        <text key={`${node.id}_title_${idx}`} fg={isFocus ? graphTheme.color.focusLabel : graphTheme.color.label}>
          {centerText(line, cardInnerWidth)}
        </text>
      ))}
    </box>
  );
}

function connectorColor(kind: FlowGraphEdgeKind | undefined): string {
  return kind ? edgeColor(kind) : graphTheme.color.rail;
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

function centerText(value: string, width: number): string {
  const textWidth = Math.min(width, lineDisplayWidth(value));
  const leftPad = Math.max(0, Math.floor((width - textWidth) / 2));
  const rightPad = Math.max(0, width - textWidth - leftPad);
  return `${' '.repeat(leftPad)}${value}${' '.repeat(rightPad)}`;
}

function fitTitleLines(value: string, width: number): string[] {
  const lines = wrapDisplayLines(value, Math.max(8, width));
  if (lines.length <= 2) return lines;
  return [lines[0], truncate(lines[1], Math.max(8, width))];
}

const generatingFrames = ['·', '••', '•••', '••'];

function getNodeRuntimePhase(node: FlowGraphNode): 'running' | 'generating' | 'stable' {
  const normalizedLabel = node.label.trim().toLowerCase();
  if (node.status === 'running' || normalizedLabel === 'running') return 'running';
  if (normalizedLabel === 'generating') return 'generating';
  return 'stable';
}
