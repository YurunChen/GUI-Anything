/**
 * useWikiMatches — prior KNOWLEDGE via SessionBundleService + wiki-retrieval-policy.
 */

import { useMemo, useRef, useEffect } from 'react';
import type { Exploration, WikiMatch } from '../../../data/protocol/observer-protocol';
import { extractWikiSearchQuery } from '../../../services/wiki/wiki-retrieval-policy';
import { getSessionBundleService } from '../../../services/session/session-bundle-service';

export function useWikiMatches(
  explorations: Exploration[],
  sessionId: string,
  sessionPath?: string,
  allowLiveSearch: boolean = true,
): Record<string, WikiMatch | null> {
  const cacheRef = useRef(new Map<string, { query: string; match: WikiMatch | null }>());

  useEffect(() => {
    cacheRef.current.clear();
  }, [sessionId]);

  return useMemo(() => {
    const out: Record<string, WikiMatch | null> = {};
    if (!sessionId.trim()) return out;

    const bundleService = getSessionBundleService();
    const path = sessionPath?.trim() || '';

    for (const exploration of explorations) {
      const query = extractWikiSearchQuery(exploration);
      if (!query) {
        out[exploration.id] = null;
        continue;
      }

      const cached = cacheRef.current.get(exploration.id);
      if (cached?.query === query) {
        out[exploration.id] = cached.match;
        continue;
      }

      const match = bundleService.ensureExplorationRetrieval(
        sessionId,
        exploration,
        path,
        allowLiveSearch,
      );
      cacheRef.current.set(exploration.id, { query, match });
      out[exploration.id] = match;
    }
    return out;
  }, [explorations, sessionId, sessionPath, allowLiveSearch]);
}
