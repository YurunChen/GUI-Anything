import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowGraphSnapshot,
  SessionScopedId,
} from '../../data/protocol/observer-protocol';

export interface GraphDigestNode {
  id: SessionScopedId;
  title: string;
  status: FlowGraphNode['status'];
  parentIds: SessionScopedId[];
  summary: string;
  updatedAt: number;
}

export interface GraphDigest {
  nodes: GraphDigestNode[];
  edges: FlowGraphEdge[];
  generatedAt: number;
}

export interface BuildGraphDigestOptions {
  maxNodes: number;
}

export function buildGraphDigest(
  snapshot: FlowGraphSnapshot,
  options: BuildGraphDigestOptions,
): GraphDigest {
  const maxNodes = Math.max(1, options.maxNodes);
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const ranked = [...snapshot.nodes].sort((a, b) => {
    const startDiff = b.startedAt - a.startedAt;
    if (startDiff !== 0) return startDiff;
    return a.id.localeCompare(b.id);
  });
  const keptIds = new Set(ranked.slice(0, maxNodes).map((node) => node.id));
  const filteredEdges = snapshot.edges.filter((edge) => keptIds.has(edge.from) && keptIds.has(edge.to));
  const parentIdsByNode = new Map<SessionScopedId, SessionScopedId[]>();
  for (const edge of filteredEdges) {
    const current = parentIdsByNode.get(edge.to) ?? [];
    current.push(edge.from);
    parentIdsByNode.set(edge.to, current);
  }

  const digestNodes: GraphDigestNode[] = [...keptIds]
    .map((id) => nodeById.get(id))
    .filter((node): node is FlowGraphNode => !!node)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((node) => ({
      id: node.id,
      title: node.label,
      status: node.status,
      parentIds: parentIdsByNode.get(node.id) ?? [],
      summary: node.summaryPreview,
      updatedAt: snapshot.updatedAt,
    }));

  return {
    nodes: digestNodes,
    edges: filteredEdges,
    generatedAt: Date.now(),
  };
}
