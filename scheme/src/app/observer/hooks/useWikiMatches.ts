/**
 * useWikiMatches — prior KNOWLEDGE via SessionBundleService + wiki-retrieval-policy.
 */

import { useRef, useEffect, useState } from 'react';
import type { Exploration, WikiMatch } from '../../../data/protocol/observer-protocol';
import { extractWikiSearchQuery } from '../../../services/wiki/wiki-retrieval-policy';
import { getSessionBundleService } from '../../../services/session/session-bundle-service';

type WikiMatchCacheEntry = {
  query: string;
  allowLiveSearch: boolean;
  match: WikiMatch | null;
};

interface WikiMatchState {
  sessionId: string;
  matches: Record<string, WikiMatch | null>;
}

export function useWikiMatches(
  explorations: Exploration[],
  sessionId: string,
  sessionPath?: string,
  allowLiveSearch: boolean = true,
): Record<string, WikiMatch | null> {
  const cacheRef = useRef(new Map<string, WikiMatchCacheEntry>());
  const [state, setState] = useState<WikiMatchState>({ sessionId: '', matches: {} });

  useEffect(() => {
    cacheRef.current.clear();
    setState((prev) => (
      prev.sessionId === sessionId && Object.keys(prev.matches).length === 0
        ? prev
        : { sessionId, matches: {} }
    ));
  }, [sessionId]);

  useEffect(() => {
    const out: Record<string, WikiMatch | null> = {};
    if (!sessionId.trim()) {
      setState((prev) => (
        prev.sessionId === sessionId && Object.keys(prev.matches).length === 0
          ? prev
          : { sessionId, matches: out }
      ));
      return;
    }

    const bundleService = getSessionBundleService();
    const path = sessionPath?.trim() || '';

    for (const exploration of explorations) {
      const query = extractWikiSearchQuery(exploration);
      if (!query) {
        out[exploration.id] = null;
        continue;
      }

      const cached = cacheRef.current.get(exploration.id);
      if (cached?.query === query && cached.allowLiveSearch === allowLiveSearch) {
        out[exploration.id] = cached.match;
        continue;
      }

      const match = bundleService.ensureExplorationRetrieval(
        sessionId,
        exploration,
        path,
        allowLiveSearch,
      );
      cacheRef.current.set(exploration.id, { query, allowLiveSearch, match });
      out[exploration.id] = match;
    }

    setState((prev) => (
      prev.sessionId === sessionId && sameWikiMatchMap(prev.matches, out)
        ? prev
        : { sessionId, matches: out }
    ));
  }, [explorations, sessionId, sessionPath, allowLiveSearch]);

  return state.sessionId === sessionId ? state.matches : {};
}

function sameWikiMatchMap(
  a: Record<string, WikiMatch | null>,
  b: Record<string, WikiMatch | null>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
