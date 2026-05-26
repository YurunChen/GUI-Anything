/**
 * useWikiMatch - application adapter for prior wiki retrieval per exploration.
 */

import type { Exploration, WikiMatch } from '../../../data/protocol/observer-protocol';
import { WIKI_SEARCH_THRESHOLD } from '../../../constants/flow-constants';
import {
  extractWikiSearchQuery,
  findPriorKnowledgeForExploration,
} from '../../../services/wiki/wiki-retrieval-policy';

export { extractWikiSearchQuery };

/**
 * @deprecated Observer paths should use SessionBundleService.ensureExplorationRetrieval.
 * Read-only search for CLI/maintenance — does not read or write bundle retrieval.
 */
export function matchWikiForExploration(
  exploration: Exploration | undefined,
  sessionId: string,
  threshold: number = WIKI_SEARCH_THRESHOLD,
): WikiMatch | null {
  if (!exploration) return null;
  return findPriorKnowledgeForExploration(exploration, sessionId, threshold);
}
