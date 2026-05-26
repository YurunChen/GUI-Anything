/**
 * Session bundle aggregate — wiki/sessions/{sessionId}/bundle.json
 */

import type {
  ExplorationId,
  FlowGraphSnapshot,
  FlowchartHint,
  GraphPatch,
  IntentBucket,
  PersistResultStatus,
  SessionId,
  SessionIntentState,
  TitleDelta,
  WikiPersistMeta,
} from '../protocol/observer-protocol';

export const SESSION_BUNDLE_SCHEMA_VERSION = 1 as const;
export const SESSION_INDEX_SCHEMA_VERSION = 1 as const;

export interface SessionIndexEntry {
  jsonlMtime: number;
  bundleUpdatedAt: number;
}

export interface SessionIndex {
  schemaVersion: typeof SESSION_INDEX_SCHEMA_VERSION;
  workspaceRoot: string;
  lastSessionId: string | null;
  updatedAt: number;
  sessions: Record<SessionId, SessionIndexEntry>;
}

export interface ExplorationCardMeta {
  status: 'complete' | 'interrupted';
  toolCount: number;
  errorCount: number;
  toolSummary?: string;
}

export interface ExplorationCardSummary {
  text: string;
  source: 'ai' | 'fallback';
  status: 'ready' | 'failed';
  reason?: string;
  flowchart?: FlowchartHint;
  persistMeta?: WikiPersistMeta | null;
  savedAt: number;
}

/** Prior knowledge match pinned at question time (wiki search hit, not a session write). */
export type WikiRetrievalSnapshot = {
  origin: 'retrieved';
  entryId: string;
  relativePath: string;
  type: 'context' | 'entity' | 'summary';
  slug: string;
  request: string;
  excerpt: string;
  tags: string[];
  score: number;
  matchedKeywords: string[];
  capturedAt: number;
};

/** @deprecated use WikiRetrievalSnapshot */
export type KnowledgeSnapshot = WikiRetrievalSnapshot;

/** Wiki curator persist outcome for this exploration (written to wiki/knowledge/). */
export interface ExplorationCardWrite {
  origin: 'saved';
  status: PersistResultStatus;
  reason?: string;
  targetId?: string;
  targetPath?: string;
  turnCount?: number;
  persistMeta?: WikiPersistMeta | null;
  completedAt: number;
}

export interface ExplorationCardRecord {
  explorationId: ExplorationId;
  question: string;
  meta?: ExplorationCardMeta;
  summary?: ExplorationCardSummary | null;
  /** Prior knowledge search hit shown on the KNOWLEDGE card. */
  retrieval?: WikiRetrievalSnapshot | null;
  /** Wiki entry saved by curator for this exploration. */
  write?: ExplorationCardWrite | null;
}

export interface BundleEvidenceEntry {
  explorationId: string;
  request: string;
  summary: string;
  result: string;
  duration: number;
  tokens: number;
  commands: string[];
  files: string[];
  nodes: unknown[];
  persistMeta: unknown | null;
  savedAt: string;
  endedAt?: number;
}

export interface SessionBundle {
  schemaVersion: typeof SESSION_BUNDLE_SCHEMA_VERSION;
  meta: {
    sessionId: SessionId;
    workspaceRoot: string;
    jsonlPath: string;
    jsonlMtime: number;
    updatedAt: number;
  };
  session: {
    intent: SessionIntentState | null;
    flow: {
      revision: number;
      fingerprint: string;
      flowGraph: FlowGraphSnapshot;
      flowchartHints: Record<ExplorationId, FlowchartHint>;
      graphPatchLedger: GraphPatch[];
    };
  };
  curation: {
    openIntentKey: string;
    buckets: Record<string, IntentBucket>;
    evidence: Record<ExplorationId, BundleEvidenceEntry>;
  };
  explorations: Record<ExplorationId, ExplorationCardRecord>;
}

export interface BundleLoadResult {
  status: 'hit' | 'miss' | 'expired' | 'stale' | 'corrupted';
  bundle: SessionBundle | null;
  reason: string;
}
