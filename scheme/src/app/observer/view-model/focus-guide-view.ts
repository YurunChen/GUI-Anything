import type { ObserverLocale } from '../../../constants/observer-locale';
import type {
  FlowGraphEdgeRelationship,
  FlowGraphNode,
  FlowGraphSnapshot,
  SessionScopedId,
} from '../../../data/protocol/observer-protocol';
import { resolveGraphNodeChromeParts } from './flow-graph-node-display';
import { buildTreeRows, type TreeDataNode } from './tree-view-model';

interface FlowTreeMeta {
  flowNode: FlowGraphNode;
  incomingRelationship?: FlowGraphEdgeRelationship;
}

export interface FocusDisplayRow {
  id: SessionScopedId;
  badge: string | null;
  title: string;
  depth: number;
  relationship: FlowGraphEdgeRelationship | 'root';
  isFocus: boolean;
  isActive: boolean;
}

export interface FocusDisplay {
  mainRows: FocusDisplayRow[];
  branchRows: FocusDisplayRow[];
  branchSignal: 'available' | 'weak';
}

export function buildFocusDisplay(
  snapshot: FlowGraphSnapshot,
  locale: ObserverLocale = 'en',
): FocusDisplay {
  const focusNode = resolveFocusNode(snapshot);
  const graph = buildFocusGraph(snapshot);
  const mainNodeIds = focusNode ? resolveFocusPath(focusNode.id, graph.parentById) : [];
  const mainNodeIdSet = new Set(mainNodeIds);
  const branchNodeIds = resolveBranchNodeIds(mainNodeIds, mainNodeIdSet, graph.childrenById);
  const branchSignal = snapshot.edges.some((edge) => edge.relationship !== 'main')
    ? 'available'
    : 'weak';

  return {
    mainRows: mainNodeIds
      .map((id, index) => rowForNode(
        graph.nodeById.get(id),
        locale,
        index,
        graph.relationshipById.get(id) ?? 'root',
        focusNode?.id,
      ))
      .filter((row): row is FocusDisplayRow => !!row),
    branchRows: branchNodeIds
      .map(({ id, depth }) => rowForNode(
        graph.nodeById.get(id),
        locale,
        depth,
        graph.relationshipById.get(id) ?? 'side',
        focusNode?.id,
      ))
      .filter((row): row is FocusDisplayRow => !!row),
    branchSignal,
  };
}

export function buildFlowTreeData(snapshot: FlowGraphSnapshot): TreeDataNode<FlowTreeMeta>[] {
  const indexById = new Map(snapshot.nodes.map((node, index) => [node.id, index]));
  const childrenById = new Map<SessionScopedId, Array<{ to: SessionScopedId; relationship: FlowGraphEdgeRelationship }>>();
  const incomingById = new Map<SessionScopedId, FlowGraphEdgeRelationship>();
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const inDegree = new Map<SessionScopedId, number>();

  for (const node of snapshot.nodes) {
    childrenById.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  for (const edge of snapshot.edges) {
    const children = childrenById.get(edge.from);
    if (children) children.push({ to: edge.to, relationship: edge.relationship });
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    if (!incomingById.has(edge.to)) incomingById.set(edge.to, edge.relationship);
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
    incomingRelationship: FlowGraphEdgeRelationship | undefined,
  ): TreeDataNode<FlowTreeMeta> | null => {
    if (visited.has(id)) return null;
    visited.add(id);
    const node = nodeById.get(id);
    if (!node) return null;
    const children = childrenById.get(id) ?? [];
    const treeChildren: TreeDataNode<FlowTreeMeta>[] = [];
    for (const child of children) {
      const treeChild = buildNode(child.to, child.relationship);
      if (treeChild) treeChildren.push(treeChild);
    }
    return {
      id: node.id,
      text: node.label,
      children: treeChildren,
      meta: {
        flowNode: node,
        incomingRelationship,
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

interface FocusGraph {
  nodeById: Map<SessionScopedId, FlowGraphNode>;
  parentById: Map<SessionScopedId, SessionScopedId>;
  relationshipById: Map<SessionScopedId, FlowGraphEdgeRelationship>;
  childrenById: Map<SessionScopedId, Array<{ id: SessionScopedId; relationship: FlowGraphEdgeRelationship }>>;
}

function buildFocusGraph(snapshot: FlowGraphSnapshot): FocusGraph {
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const parentById = new Map<SessionScopedId, SessionScopedId>();
  const relationshipById = new Map<SessionScopedId, FlowGraphEdgeRelationship>();
  const childrenById = new Map<SessionScopedId, Array<{ id: SessionScopedId; relationship: FlowGraphEdgeRelationship }>>();
  for (const node of snapshot.nodes) {
    childrenById.set(node.id, []);
  }
  for (const edge of snapshot.edges) {
    childrenById.get(edge.from)?.push({ id: edge.to, relationship: edge.relationship });
    if (!parentById.has(edge.to)) {
      parentById.set(edge.to, edge.from);
      relationshipById.set(edge.to, edge.relationship);
    }
  }
  const indexById = new Map(snapshot.nodes.map((node, index) => [node.id, index]));
  for (const [id, children] of childrenById) {
    children.sort((a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0));
    childrenById.set(id, children);
  }
  return { nodeById, parentById, relationshipById, childrenById };
}

function resolveFocusPath(
  focusNodeId: SessionScopedId,
  parentById: Map<SessionScopedId, SessionScopedId>,
): SessionScopedId[] {
  const path: SessionScopedId[] = [];
  const seen = new Set<SessionScopedId>();
  let current: SessionScopedId | undefined = focusNodeId;
  while (current && !seen.has(current)) {
    seen.add(current);
    path.push(current);
    current = parentById.get(current);
  }
  return path.reverse();
}

function resolveBranchNodeIds(
  mainNodeIds: SessionScopedId[],
  mainNodeIdSet: Set<SessionScopedId>,
  childrenById: FocusGraph['childrenById'],
): Array<{ id: SessionScopedId; depth: number }> {
  const out: Array<{ id: SessionScopedId; depth: number }> = [];
  mainNodeIds.forEach((id, index) => {
    const children = childrenById.get(id) ?? [];
    for (const child of children) {
      if (mainNodeIdSet.has(child.id)) continue;
      if (child.relationship === 'main' || child.relationship === 'merge') continue;
      out.push({ id: child.id, depth: index + 1 });
    }
  });
  return out.slice(0, 6);
}

function rowForNode(
  node: FlowGraphNode | undefined,
  locale: ObserverLocale,
  depth: number,
  relationship: FocusDisplayRow['relationship'],
  focusNodeId: SessionScopedId | undefined,
): FocusDisplayRow | null {
  if (!node) return null;
  const parts = resolveGraphNodeChromeParts(node, locale);
  return {
    id: node.id,
    badge: parts.badge,
    title: parts.title,
    depth,
    relationship,
    isFocus: focusNodeId === node.id,
    isActive: getNodeRuntimePhase(node) !== 'stable',
  };
}

function resolveFocusNode(snapshot: FlowGraphSnapshot): FlowGraphNode | null {
  if (snapshot.focusNodeId) {
    const focusNode = snapshot.nodes.find((node) => node.id === snapshot.focusNodeId);
    if (focusNode) return focusNode;
  }
  const activeNode = snapshot.nodes.find((node) => getNodeRuntimePhase(node) !== 'stable');
  return activeNode ?? snapshot.nodes.at(-1) ?? null;
}

function getNodeRuntimePhase(node: FlowGraphNode): 'running' | 'generating' | 'stable' {
  const normalizedLabel = node.label.trim().toLowerCase();
  if (node.status === 'running' || normalizedLabel === 'running') return 'running';
  if (normalizedLabel === 'generating') return 'generating';
  return 'stable';
}
