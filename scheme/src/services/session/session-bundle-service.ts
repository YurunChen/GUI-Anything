/**
 * Session bundle facade — hooks/services access wiki/sessions/{id}/bundle.json here.
 */

import type { ExplorationId, SessionId } from '../../data/protocol/observer-protocol';
import type { SessionIntentState } from '../../data/protocol/observer-protocol';
import {
  defaultSessionBundleRepository,
  type SessionBundleRepository,
} from '../../data/wiki/session-bundle-repository';
import type { Exploration } from '../../data/protocol/observer-protocol';
import type { WikiMatch } from '../../data/protocol/wiki-types';
import type {
  BundleLoadResult,
  ExplorationCardRecord,
  SessionBundle,
} from '../../data/wiki/session-bundle-types';
import { ensureExplorationRetrieval } from '../wiki/wiki-retrieval-policy';

export class SessionBundleService {
  constructor(private readonly repository: SessionBundleRepository = defaultSessionBundleRepository()) {}

  /** Shared repository instance for app-layer services (same singleton as defaultSessionBundleRepository). */
  getRepository(): SessionBundleRepository {
    return this.repository;
  }

  load(sessionId: SessionId): SessionBundle | null {
    return this.repository.load(sessionId);
  }

  loadWithStatus(sessionId: SessionId, jsonlPath: string): BundleLoadResult {
    return this.repository.loadWithStatus(sessionId, jsonlPath);
  }

  getSessionIntent(sessionId: SessionId): SessionIntentState | null {
    return this.repository.load(sessionId)?.session.intent ?? null;
  }

  patch(
    sessionId: SessionId,
    mutator: (bundle: SessionBundle) => void,
    jsonlPath?: string,
  ): SessionBundle {
    return this.repository.patch(sessionId, mutator, jsonlPath);
  }

  patchExploration(
    sessionId: SessionId,
    explorationId: ExplorationId,
    patch: Partial<ExplorationCardRecord> & { question?: string },
    jsonlPath?: string,
  ): SessionBundle {
    return this.repository.patchExploration(sessionId, explorationId, patch, jsonlPath);
  }

  ensureExplorationRetrieval(
    sessionId: SessionId,
    exploration: Exploration,
    jsonlPath: string,
    allowLiveSearch: boolean,
  ): WikiMatch | null {
    return ensureExplorationRetrieval({
      sessionId,
      exploration,
      jsonlPath,
      allowLiveSearch,
      bundleRepository: this.repository,
    });
  }
}

let defaultService: SessionBundleService | null = null;

export function getSessionBundleService(): SessionBundleService {
  if (!defaultService) {
    defaultService = new SessionBundleService();
  }
  return defaultService;
}

/** App-layer bundle IO — prefer over direct defaultSessionBundleRepository() in services/hooks. */
export function getSessionBundleRepository(): SessionBundleRepository {
  return getSessionBundleService().getRepository();
}
