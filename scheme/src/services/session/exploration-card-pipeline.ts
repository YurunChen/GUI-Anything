/**
 * Exploration card pipeline — live card build order: prior KNOWLEDGE retrieval → summary.
 */

import type { Exploration } from '../../data/protocol/observer-protocol';
import type { WikiMatch } from '../../data/protocol/wiki-types';
import type { SessionBundleRepository } from '../../data/wiki/session-bundle-repository';
import {
  ensureExplorationRetrieval,
  isExplorationRetrievalResolved,
} from '../wiki/wiki-retrieval-policy';

export interface EnsureExplorationCardRetrievalInput {
  sessionId: string;
  exploration: Exploration;
  jsonlPath: string;
  allowLiveSearch: boolean;
  bundleRepository?: SessionBundleRepository;
}

/** Resolve prior KNOWLEDGE on bundle before summary generation or UI display. */
export function ensureExplorationCardRetrieval(
  input: EnsureExplorationCardRetrievalInput,
): WikiMatch | null {
  return ensureExplorationRetrieval(input);
}

export { isExplorationRetrievalResolved };
