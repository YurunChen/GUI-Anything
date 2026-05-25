/**
 * useWikiMatches — prior KNOWLEDGE retrieval once per exploration question.
 * Pinned at first searchable query; wiki persist does not trigger re-match.
 */

import { useMemo, useRef, useEffect } from 'react';
import type { Exploration, WikiMatch } from '../../../data/protocol/observer-protocol';
import {
  extractWikiSearchQuery,
  findPriorKnowledgeForExploration,
} from '../../../services/wiki/wiki-retrieval-policy';

export function useWikiMatches(
  explorations: Exploration[],
  sessionId: string,
): Record<string, WikiMatch | null> {
  const cacheRef = useRef(new Map<string, { query: string; match: WikiMatch | null }>());

  useEffect(() => {
    cacheRef.current.clear();
  }, [sessionId]);

  return useMemo(() => {
    const out: Record<string, WikiMatch | null> = {};
    if (!sessionId.trim()) return out;

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

      const match = findPriorKnowledgeForExploration(exploration, sessionId);
      cacheRef.current.set(exploration.id, { query, match });
      out[exploration.id] = match;
    }
    return out;
  }, [explorations, sessionId]);
}
