import {
  makeSessionScopedId,
  type Exploration,
  type FlowchartHint,
  type FlowGraphEdge,
  type FlowGraphEdgeKind,
  type FlowGraphNode,
  type FlowGraphSnapshot,
  type SessionScopedId,
} from '../../../../data/protocol/observer-protocol';

export interface BuildFlowGraphInput {
  sessionId: string;
  explorations: Exploration[];
  summaries: Record<string, string>;
  flowchartHints?: Record<string, FlowchartHint>;
  wikiPersistStatus?: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
}

export function buildFlowGraphSnapshot(input: BuildFlowGraphInput): FlowGraphSnapshot {
  const ordered = sortExplorations(input.explorations);
  const aliases = new Map<string, string>();
  const buckets = new Map<string, IntentBucket>();
  let createdOrder = 0;
  let previousIntentKey: string | undefined;
  let previousTrunkKey: string | undefined;

  for (const exploration of ordered) {
    const summaryText = normalizeSummary(input.summaries[exploration.id]);
    const hint = input.flowchartHints?.[exploration.id];
    if (hint?.dropFromChart || hint?.importance === 'low') {
      continue;
    }

    const normalizedHint = normalizeHint(exploration, hint, summaryText);
    const intentKey = normalizedHint.intentKey;
    const nodeAlias = normalizedHint.nodeId;
    aliases.set(nodeAlias, intentKey);
    aliases.set(normalizedHint.intentKey, intentKey);

    const existing = buckets.get(intentKey);
    const bucket = existing ?? createIntentBucket(intentKey, exploration.id, createdOrder++);
    bucket.intentKey = intentKey;
    bucket.nodeAlias = nodeAlias;
    bucket.parentAlias = normalizedHint.parentId;
    bucket.branchType = normalizedHint.branchType;
    bucket.label = normalizedHint.nodeTitle;
    bucket.summaryPreview = summaryText || bucket.summaryPreview;
    bucket.startedAt = Math.min(bucket.startedAt, exploration.startedAt);
    bucket.endedAt = exploration.endedAt ?? bucket.endedAt;
    bucket.status = mergeStatus(bucket.status, toExplorationStatus(exploration));
    bucket.toolCount += exploration.nodes.filter((node) => node.type === 'tool').length;
    bucket.errorCount += exploration.errorCounts.tool + exploration.errorCounts.system + exploration.errorCounts.result;
    bucket.wikiState = input.wikiPersistStatus?.[exploration.id] ?? bucket.wikiState;
    bucket.representativeExplorationId = exploration.id;
    bucket.fallbackParentKey = previousTrunkKey ?? previousIntentKey;
    buckets.set(intentKey, bucket);

    previousIntentKey = intentKey;
    if (normalizedHint.branchType === 'trunk' || normalizedHint.branchType === 'merge') {
      previousTrunkKey = intentKey;
    }
  }

  // Guardrail: never render an empty flowchart.
  // If all nodes were filtered out by LLM hints (e.g. greeting turns marked as drop_from_chart),
  // keep the latest exploration as a fallback intent node so the tree does not disappear.
  if (buckets.size === 0 && ordered.length > 0) {
    const fallback = ordered.at(-1)!;
    const summaryText = normalizeSummary(input.summaries[fallback.id]);
    const fallbackHint = normalizeHint(fallback, input.flowchartHints?.[fallback.id], summaryText);
    const intentKey = fallbackHint.intentKey || normalizeIntentKey(`exp_${fallback.id}`);
    const bucket = createIntentBucket(intentKey, fallback.id, 0);
    bucket.nodeAlias = fallbackHint.nodeId;
    bucket.parentAlias = null;
    bucket.branchType = 'trunk';
    bucket.label = fallbackHint.nodeTitle || buildRequirementTitle(fallback.question, summaryText);
    bucket.summaryPreview = summaryText;
    bucket.startedAt = fallback.startedAt;
    bucket.endedAt = fallback.endedAt;
    bucket.status = toExplorationStatus(fallback);
    bucket.toolCount = fallback.nodes.filter((node) => node.type === 'tool').length;
    bucket.errorCount = fallback.errorCounts.tool + fallback.errorCounts.system + fallback.errorCounts.result;
    bucket.wikiState = input.wikiPersistStatus?.[fallback.id] ?? 'none';
    bucket.representativeExplorationId = fallback.id;
    buckets.set(intentKey, bucket);
  }

  const bucketList = [...buckets.values()].sort((a, b) => a.createdOrder - b.createdOrder);
  const nodes: FlowGraphNode[] = bucketList.map((bucket) => {
    const explorationId = bucket.representativeExplorationId;
    const scopedId = makeSessionScopedId(
      input.sessionId,
      makeIntentScopedExplorationId(bucket.intentKey, explorationId),
    );
    bucket.scopedId = scopedId;
    return {
      id: scopedId,
      explorationId,
      label: truncate(bucket.label || '未命名意图', 42),
      status: bucket.status,
      startedAt: bucket.startedAt,
      endedAt: bucket.endedAt,
      summaryPreview: bucket.summaryPreview ? truncate(bucket.summaryPreview, 160) : 'no summary',
      metaBadges: {
        tools: bucket.toolCount,
        errors: bucket.errorCount,
        wiki: bucket.wikiState,
      },
    };
  });

  const bucketByKey = new Map(bucketList.map((bucket) => [bucket.intentKey, bucket]));
  const edges: FlowGraphEdge[] = [];
  const roots: IntentBucket[] = [];
  const firstNode = bucketList[0];
  for (const bucket of bucketList) {
    if (!bucket.scopedId) continue;
    const parentKey = resolveParentKey(bucket, aliases, bucketByKey);
    if (!parentKey || parentKey === bucket.intentKey) {
      roots.push(bucket);
      continue;
    }
    const parent = bucketByKey.get(parentKey);
    if (!parent?.scopedId) {
      roots.push(bucket);
      continue;
    }
    edges.push({
      from: parent.scopedId,
      to: bucket.scopedId,
      kind: mapBranchTypeToEdgeKind(bucket.branchType),
    });
  }

  if (firstNode?.scopedId) {
    for (let i = 1; i < roots.length; i++) {
      const root = roots[i];
      if (!root.scopedId) continue;
      edges.push({
        from: firstNode.scopedId,
        to: root.scopedId,
        kind: 'trunk',
      });
    }
  }

  const focusNodeId = pickFocusNodeId(nodes);
  return {
    nodes,
    edges,
    focusNodeId,
    updatedAt: Date.now(),
  };
}

function sortExplorations(explorations: Exploration[]): Exploration[] {
  return [...explorations].sort((a, b) => {
    const start = a.startedAt - b.startedAt;
    if (start !== 0) return start;
    const endA = a.endedAt ?? Number.MAX_SAFE_INTEGER;
    const endB = b.endedAt ?? Number.MAX_SAFE_INTEGER;
    const end = endA - endB;
    if (end !== 0) return end;
    return a.id.localeCompare(b.id);
  });
}

function pickFocusNodeId(nodes: FlowGraphNode[]): SessionScopedId | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i].status === 'running') return nodes[i].id;
  }
  return nodes.at(-1)?.id;
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1))}…`;
}

function buildRequirementTitle(question: string, summaryText: string): string {
  const candidate = summaryText || question;
  const normalized = candidate.replace(/\s+/g, ' ').trim();
  const withoutPrefix = normalized
    .replace(/^用户(请求|要求|希望|想|需要|发送|提问)?/u, '')
    .replace(/^请(帮我|协助|分析|实现|处理)?/u, '')
    .trim();
  const firstClause = withoutPrefix.split(/[。！？.!?，,;]/u).find((part) => part.trim().length > 0)?.trim() || withoutPrefix;
  return truncate(firstClause || '未命名需求', 26);
}

interface IntentBucket {
  intentKey: string;
  nodeAlias: string;
  parentAlias: string | null;
  branchType: 'trunk' | 'parallel' | 'repair' | 'merge';
  label: string;
  summaryPreview: string;
  representativeExplorationId: string;
  startedAt: number;
  endedAt?: number;
  status: FlowGraphNode['status'];
  toolCount: number;
  errorCount: number;
  wikiState: 'saved' | 'skipped' | 'failed' | 'pending' | 'none';
  fallbackParentKey?: string;
  createdOrder: number;
  scopedId?: SessionScopedId;
}

function createIntentBucket(intentKey: string, explorationId: string, createdOrder: number): IntentBucket {
  return {
    intentKey,
    nodeAlias: intentKey,
    parentAlias: null,
    branchType: 'trunk',
    label: '',
    summaryPreview: '',
    representativeExplorationId: explorationId,
    startedAt: Number.MAX_SAFE_INTEGER,
    status: 'complete',
    toolCount: 0,
    errorCount: 0,
    wikiState: 'none',
    createdOrder,
  };
}

function normalizeSummary(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeHint(
  exploration: Exploration,
  hint: FlowchartHint | undefined,
  summaryText: string,
): FlowchartHint {
  const fallbackTitle = resolveFallbackTitle(exploration, hint, summaryText);
  const fallbackId = normalizeIntentKey(`exp_${exploration.id}`);
  return {
    nodeId: normalizeIntentKey(hint?.nodeId || fallbackId),
    nodeTitle: normalizeNodeTitle((hint?.nodeTitle || fallbackTitle).trim(), fallbackTitle),
    parentId: hint?.parentId ? normalizeIntentKey(hint.parentId) : null,
    branchType: hint?.branchType || 'trunk',
    importance: hint?.importance || 'medium',
    dropFromChart: hint?.dropFromChart ?? false,
    intentKey: normalizeIntentKey(hint?.intentKey || hint?.nodeId || fallbackId),
  };
}

function resolveFallbackTitle(
  exploration: Exploration,
  hint: FlowchartHint | undefined,
  summaryText: string,
): string {
  if (hint?.nodeTitle?.trim()) {
    return hint.nodeTitle.trim();
  }
  // Claude core is still actively executing this exploration.
  if (exploration.status === 'running') {
    return 'running';
  }
  // Claude finished exploration, summary/intent generation is pending.
  if (summaryText.length === 0) {
    return 'generating';
  }
  return buildRequirementTitle(exploration.question, summaryText);
}

function normalizeIntentKey(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'intent';
}

function makeIntentScopedExplorationId(intentKey: string, fallbackExplorationId: string): string {
  const base = normalizeIntentKey(intentKey).slice(0, 36);
  const suffix = normalizeIntentKey(fallbackExplorationId).slice(0, 20);
  return `${base || 'intent'}_${suffix || 'exp'}`;
}

function toExplorationStatus(exploration: Exploration): FlowGraphNode['status'] {
  const errors = exploration.errorCounts.tool + exploration.errorCounts.system + exploration.errorCounts.result;
  if (errors > 0) return 'error';
  if (exploration.status === 'running') return 'running';
  if (exploration.status === 'interrupted') return 'interrupted';
  return 'complete';
}

function mergeStatus(current: FlowGraphNode['status'], next: FlowGraphNode['status']): FlowGraphNode['status'] {
  const rank: Record<FlowGraphNode['status'], number> = {
    running: 4,
    error: 3,
    interrupted: 2,
    complete: 1,
  };
  return rank[next] > rank[current] ? next : current;
}

function resolveParentKey(
  bucket: IntentBucket,
  aliases: Map<string, string>,
  bucketByKey: Map<string, IntentBucket>,
): string | undefined {
  if (bucket.parentAlias) {
    const direct = aliases.get(bucket.parentAlias) || bucket.parentAlias;
    if (bucketByKey.has(direct)) return direct;
  }
  if (bucket.fallbackParentKey && bucketByKey.has(bucket.fallbackParentKey)) {
    return bucket.fallbackParentKey;
  }
  return undefined;
}

function mapBranchTypeToEdgeKind(branchType: FlowchartHint['branchType']): FlowGraphEdgeKind {
  if (branchType === 'parallel') return 'fork_alternative';
  if (branchType === 'repair') return 'fork_repair';
  if (branchType === 'merge') return 'merge';
  return 'trunk';
}

function normalizeNodeTitle(rawTitle: string, fallbackTitle: string): string {
  const cleaned = rawTitle
    .replace(/[“”"']/g, '')
    .replace(/^(围绕|针对|关于)\s*/u, '')
    .replace(/[。！？.!?]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  const title = cleaned || fallbackTitle;
  return truncate(title, 36);
}
