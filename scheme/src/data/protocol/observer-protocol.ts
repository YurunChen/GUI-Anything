import type { ActivityTree } from '../../domain/types';
import type {
  Exploration,
  ExplorationNode,
  SessionStats,
} from '../session/session-types';
import type {
  WikiExtractionResult,
  WikiMatch,
  WikiPersistMeta,
} from './wiki-types';
import type { DailyNoteRecord } from '../wiki/note-repository';

export type SessionId = string;
export type ExplorationId = string;
export type SessionScopedId = `${SessionId}:${ExplorationId}`;

export type { ActivityTree, Exploration, ExplorationNode, SessionStats };
export type { WikiExtractionResult, WikiMatch, WikiPersistMeta };
/** User inspiration notes stored under wiki/notes/ */
export type InspirationRecord = DailyNoteRecord;

export interface ObserverSessionSnapshot {
  sessionId: SessionId;
  sessionPath: string;
  sourceMtimeMs: number;
  runtimeModel: string;
  tokenDisplay: string;
  tree: ActivityTree | null;
  explorations: Exploration[];
  stats: SessionStats;
  updatedAt: number;
}

export type SummarySource = 'cache' | 'wiki' | 'ai' | 'fallback' | 'excerpt';
export type SummaryStatus = 'ready' | 'pending' | 'failed';

/** Cache load status for provenance tracking */
export type CacheLoadStatus = 'hit' | 'miss' | 'expired' | 'stale' | 'corrupted';

export interface ExplorationSummaryRecord {
  sessionId: SessionId;
  explorationId: ExplorationId;
  displaySummary: string;
  persistMeta: WikiPersistMeta | null;
  source: SummarySource;
}

export type WikiSummaryIndex = Record<SessionScopedId, string>;

export interface SummaryItem {
  id: SessionScopedId;
  sessionId: SessionId;
  explorationId: ExplorationId;
  text: string;
  source: SummarySource;
  status: SummaryStatus;
  persistMeta: WikiPersistMeta | null;
  /**
   * Reason for fallback status or cache/wiki hydrate info.
   * For 'fallback': indicates why AI generation failed (e.g., 'timeout', 'parse_error').
   * For 'cache': indicates cache state ('hit', 'expired', 'miss').
   */
  reason?: string;
  /** Optional LLM-provided hints for intent-centric flowchart rendering */
  flowchart?: FlowchartHint;
}

export type FlowchartBranchType = 'trunk' | 'parallel' | 'repair' | 'merge';
export type FlowchartImportance = 'high' | 'medium' | 'low';

/** How this round changed the session intent title (flowchart.node_title). */
export type TitleDelta = 'idle' | 'continue' | 'refine' | 'pivot' | 'blocked' | 'done';

export interface FlowchartHint {
  nodeId: string;
  nodeTitle: string;
  parentId: string | null;
  branchType: FlowchartBranchType;
  importance: FlowchartImportance;
  dropFromChart: boolean;
  intentKey: string;
  titleDelta?: TitleDelta;
  titleDeltaNote?: string;
}

export interface IntentTitleRevision {
  explorationId: ExplorationId;
  at: number;
  intentKey: string;
  nodeTitle: string;
  titleDelta: TitleDelta;
  titleDeltaNote?: string;
}

export interface SessionIntentState {
  sessionId: SessionId;
  revision: number;
  intentKey: string;
  nodeTitle: string;
  parentIntentKey: string | null;
  phase: 'idle' | 'active' | 'blocked' | 'done';
  history: IntentTitleRevision[];
  updatedAt: number;
}

/** Per-intent exploration bucket for wiki curation — wiki/sessions/{id}-intent-buckets.json */
export interface IntentBucket {
  intentKey: string;
  nodeTitle: string;
  explorationIds: ExplorationId[];
  curatedAt?: number;
  anchorExplorationId?: ExplorationId;
  persistResult?: PersistResult;
}

export interface IntentBucketLedger {
  sessionId: SessionId;
  openIntentKey: string;
  buckets: Record<string, IntentBucket>;
  updatedAt: number;
}

export type PersistResultStatus = 'saved' | 'updated' | 'skipped' | 'failed';
export type PersistSkipReason =
  | 'model_opt_out'
  | 'low_value'
  | 'duplicate'
  | 'missing_summary';

export interface PersistResult {
  status: PersistResultStatus;
  reason?: PersistSkipReason | string;
  id: SessionScopedId;
  path?: string;
}

export interface FlowEnv {
  flowProjectDir?: string;
  flowRootDir?: string;
  flowSessionId?: string;
  claudeModel?: string;
}

export type FlowGraphNodeStatus = 'running' | 'complete' | 'interrupted' | 'error';
export type FlowGraphEdgeKind = 'trunk' | 'fork_repair' | 'fork_alternative' | 'merge' | 'dead_end';

export interface FlowGraphMetaBadges {
  tools: number;
  errors: number;
  wiki: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending' | 'none';
}

export interface FlowGraphNode {
  id: SessionScopedId;
  explorationId: ExplorationId;
  /** Session intent_key (normalized catalog key) */
  intentKey: string;
  label: string;
  status: FlowGraphNodeStatus;
  startedAt: number;
  endedAt?: number;
  summaryPreview: string;
  metaBadges: FlowGraphMetaBadges;
}

export interface FlowGraphEdge {
  from: SessionScopedId;
  to: SessionScopedId;
  kind: FlowGraphEdgeKind;
}

export interface FlowGraphSnapshot {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
  focusNodeId?: SessionScopedId;
  updatedAt: number;
}

/** Canonical session derived state — wiki/sessions/{sessionId}.json */
export const SESSION_FLOW_RECORD_VERSION = 2 as const;

export interface SessionFlowRecord {
  version: typeof SESSION_FLOW_RECORD_VERSION;
  sessionId: SessionId;
  jsonlMtime: number;
  fingerprint: string;
  revision: number;
  updatedAt: number;
  flowGraph: FlowGraphSnapshot;
  flowchartHints: Record<ExplorationId, FlowchartHint>;
  /** Canonical git root when saved — fail-closed load if mismatched. */
  workspaceRoot?: string;
}

/** @deprecated Use SessionFlowRecord; kept for legacy -graph.json migration. */
export interface GraphCacheRecord {
  sessionId: SessionId;
  jsonlMtime: number;
  savedAt: number;
  fingerprint: string;
  snapshot: FlowGraphSnapshot;
}

export type GraphPatchOp = 'merge_intents' | 'rename_intent' | 'reparent_intent' | 'drop_intent';

export interface GraphPatch {
  op: GraphPatchOp;
  targetIntentKey?: string;
  sourceIntentKeys?: string[];
  newTitle?: string;
  newParentIntentKey?: string | null;
  reason: string;
  confidence: number;
}

export function makeSessionScopedId(
  sessionId: SessionId,
  explorationId: ExplorationId,
): SessionScopedId {
  const cleanSessionId = sessionId.trim();
  const cleanExplorationId = explorationId.trim();
  if (!cleanSessionId || !cleanExplorationId) {
    throw new Error('sessionScopedId requires non-empty sessionId and explorationId');
  }
  return `${cleanSessionId}:${cleanExplorationId}`;
}

export function splitSessionScopedId(id: SessionScopedId): {
  sessionId: SessionId;
  explorationId: ExplorationId;
} {
  const separatorIndex = id.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === id.length - 1) {
    throw new Error(`Invalid sessionScopedId: ${id}`);
  }
  return {
    sessionId: id.slice(0, separatorIndex),
    explorationId: id.slice(separatorIndex + 1),
  };
}
