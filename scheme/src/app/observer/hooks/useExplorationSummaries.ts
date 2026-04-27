/**
 * useExplorationSummaries - application adapter for summary generation.
 */

import { useState, useEffect, useRef } from 'react';
import type { Exploration, WikiPersistMeta, SessionScopedId, SummaryItem, CacheLoadStatus } from '../../../data/protocol/observer-protocol';
import {
  DefaultExplorationSummaryService,
  type CacheHydrateResult,
} from '../../../services/ai/exploration-summary-service';

interface SummaryState {
  items: Record<SessionScopedId, SummaryItem>;
  pendingCount: number;
  wikiHydratedSessionId: string;
  /** Cache provenance for UI badges */
  cacheStatus: CacheLoadStatus | null;
  cacheReason: string;
}

export function useExplorationSummaries(
  explorations: Exploration[],
  sessionId: string,
  sessionPath: string,
  summaryModel?: string,
) {
  const [state, setState] = useState<SummaryState>({
    items: {},
    pendingCount: 0,
    wikiHydratedSessionId: '',
    cacheStatus: null,
    cacheReason: '',
  });

  const summaryModelRef = useRef(summaryModel);
  summaryModelRef.current = summaryModel;

  const itemsRef = useRef(state.items);
  itemsRef.current = state.items;
  const summaryServiceRef = useRef<DefaultExplorationSummaryService | null>(null);
  if (!summaryServiceRef.current) {
    summaryServiceRef.current = new DefaultExplorationSummaryService();
  }
  const lastSessionRef = useRef<string>('');

  useEffect(() => {
    const sid = (sessionId || '').trim();
    if (sid === lastSessionRef.current) return;
    lastSessionRef.current = sid;
    summaryServiceRef.current!.resetSession(sid);
    setState({
      items: {},
      pendingCount: 0,
      wikiHydratedSessionId: '',
      cacheStatus: null,
      cacheReason: '',
    });

    // Try to load from cache immediately on session change
    if (sid && sessionPath) {
      const cached = summaryServiceRef.current!.hydrateFromCache(sid, sessionPath);
      if (cached) {
        setState((prev) => ({
          ...prev,
          items: { ...prev.items, ...cached.items },
          cacheStatus: cached.cacheStatus,
          cacheReason: cached.cacheReason,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          cacheStatus: 'miss',
          cacheReason: 'no_cache_or_expired',
        }));
      }
    }
  }, [sessionId, sessionPath]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    summaryServiceRef.current!
      .hydrateFromWiki(sessionId)
      .then((wikiItems) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          items: Object.keys(wikiItems).length > 0
            ? { ...prev.items, ...wikiItems }
            : prev.items,
          wikiHydratedSessionId: sessionId,
        }));
      })
      .catch((error) => {
        console.error('[useExplorationSummaries] Hydrate error:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || state.wikiHydratedSessionId !== sessionId || !sessionPath) return;
    let cancelled = false;
    const service = summaryServiceRef.current!;
    const pending = service.generateMissing({
      sessionId,
      explorations,
      jsonlPath: sessionPath,
      existing: itemsRef.current,
      summaryModel: summaryModelRef.current,
    });
    setState((prev) => ({
      ...prev,
      pendingCount: service.pendingCount(),
    }));
    pending
      .then((generatedItems) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          items: Object.keys(generatedItems).length > 0
            ? { ...prev.items, ...generatedItems }
            : prev.items,
          pendingCount: service.pendingCount(),
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[useExplorationSummaries] Generate error:', error);
        setState((prev) => ({
          ...prev,
          pendingCount: summaryServiceRef.current!.pendingCount(),
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [explorations, sessionId, state.wikiHydratedSessionId]);

  return {
    summaries: toExplorationSummaryMap(state.items),
    persistMeta: toExplorationPersistMetaMap(state.items),
    pendingCount: state.pendingCount,
    // Provenance for UI badges
    cacheStatus: state.cacheStatus,
    cacheReason: state.cacheReason,
    // Full items for source/reason access
    summaryItems: state.items,
  };
}

function toExplorationSummaryMap(items: Record<SessionScopedId, SummaryItem>): Record<string, string> {
  const summaries: Record<string, string> = {};
  for (const item of Object.values(items)) {
    summaries[item.explorationId] = item.text;
  }
  return summaries;
}

function toExplorationPersistMetaMap(
  items: Record<SessionScopedId, SummaryItem>,
): Record<string, WikiPersistMeta | null> {
  const persistMeta: Record<string, WikiPersistMeta | null> = {};
  for (const item of Object.values(items)) {
    persistMeta[item.explorationId] = item.persistMeta;
  }
  return persistMeta;
}
