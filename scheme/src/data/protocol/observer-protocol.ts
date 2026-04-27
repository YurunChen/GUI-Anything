import type { ActivityTree } from '../domain/types';
import type {
  Exploration,
  ExplorationNode,
  SessionStats,
} from '../services/session/posthoc';
import type { WikiMatch } from '../services/wiki/search';
import type {
  WikiExtractionResult,
  WikiPersistMeta,
} from '../services/wiki/auto-extractor';

export type SessionId = string;
export type ExplorationId = string;
export type SessionScopedId = `${SessionId}:${ExplorationId}`;

export type { ActivityTree, Exploration, ExplorationNode, SessionStats };
export type { WikiExtractionResult, WikiMatch, WikiPersistMeta };

export interface ObserverSessionSnapshot {
  sessionId: SessionId;
  sessionPath: string;
  runtimeModel: string;
  tokenDisplay: string;
  tree: ActivityTree | null;
  explorations: Exploration[];
  stats: SessionStats;
  updatedAt: number;
}

export type SummarySource = 'cache' | 'wiki' | 'ai' | 'fallback';
export type SummaryStatus = 'ready' | 'pending' | 'failed';

/** Cache load status for provenance tracking */
export type CacheLoadStatus = 'hit' | 'miss' | 'expired' | 'corrupted';

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
}

export type PersistResultStatus = 'saved' | 'skipped' | 'failed';
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
