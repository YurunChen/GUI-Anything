/**
 * useExplorationSummaries - application adapter for summary generation.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type {
  Exploration,
  SessionIntentState,
  SessionScopedId,
  SummaryItem,
  CacheLoadStatus,
} from '../../../data/protocol/observer-protocol';
import { defaultSessionIntentRepository } from '../../../data/wiki/session-intent-repository';
import {
  DefaultExplorationSummaryService,
  type CacheHydrateResult,
} from '../../../services/ai/exploration-summary-service';
import type { SessionPresentationPolicy } from '../../../services/session/session-presentation-policy';
import { applyExcerptFallback, applyLiveSummaryPreview } from '../view-model/presentation-summaries';
import {
  toExplorationFlowchartHintMap,
  toExplorationPersistMetaMap,
  toExplorationSummaryTextMap,
} from '../../../data/protocol/summary-contract';

interface SummaryState {
  items: Record<SessionScopedId, SummaryItem>;
  pendingCount: number;
  wikiHydratedSessionId: string;
  cacheStatus: CacheLoadStatus | null;
  cacheReason: string;
}

/** @deprecated Use SessionPresentationPolicy from session-presentation-policy.ts */
export interface SummaryGenerationPolicy {
  allowRegen: boolean;
  preserveStaleCache?: boolean;
  fillExcerptFallback?: boolean;
}

export function presentationToSummaryPolicy(
  presentation: SessionPresentationPolicy,
): SummaryGenerationPolicy {
  return {
    allowRegen: presentation.allowSummaryRegen,
    preserveStaleCache: presentation.preserveStaleCache,
    fillExcerptFallback: presentation.fillExcerptFallback,
  };
}

export function useExplorationSummaries(
  explorations: Exploration[],
  sessionId: string,
  sessionPath: string,
  summaryModel: string | undefined,
  presentation: SessionPresentationPolicy,
) {
  const summaryPolicy = presentationToSummaryPolicy(presentation);

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
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

    if (sid && sessionPath) {
      const cached = summaryServiceRef.current!.hydrateFromCache(sid, sessionPath, {
        preserveStale: summaryPolicy.preserveStaleCache,
      });
      setState((prev) => ({
        ...prev,
        items: Object.keys(cached.items).length > 0
          ? { ...prev.items, ...cached.items }
          : prev.items,
        cacheStatus: cached.cacheStatus,
        cacheReason: cached.cacheReason,
      }));
    }
  }, [sessionId, sessionPath, summaryPolicy.preserveStaleCache]);

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
        if (cancelled) return;
        console.error('[useExplorationSummaries] Hydrate error:', error);
        setState((prev) => ({
          ...prev,
          wikiHydratedSessionId: sessionId,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!shouldGenerateMissingSummaries({
      allowRegen: summaryPolicy.allowRegen,
      sessionId,
      wikiHydratedSessionId: state.wikiHydratedSessionId,
      sessionPath,
    })) {
      setState((prev) => ({
        ...prev,
        pendingCount: 0,
      }));
      return;
    }
    const runSessionId = sessionId;
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
        if (!mountedRef.current) return;
        if (runSessionId !== lastSessionRef.current) return;
        setState((prev) => ({
          ...prev,
          items: Object.keys(generatedItems).length > 0
            ? { ...prev.items, ...generatedItems }
            : prev.items,
          pendingCount: service.pendingCount(),
        }));
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        if (runSessionId !== lastSessionRef.current) return;
        console.error('[useExplorationSummaries] Generate error:', error);
        setState((prev) => ({
          ...prev,
          pendingCount: summaryServiceRef.current!.pendingCount(),
        }));
      });
  }, [explorations, sessionId, state.wikiHydratedSessionId, sessionPath, summaryPolicy.allowRegen]);

  const displayItems = useMemo(() => {
    let items = state.items;
    if (summaryPolicy.allowRegen) {
      items = applyLiveSummaryPreview(sessionId, explorations, items);
    }
    if (summaryPolicy.fillExcerptFallback) {
      items = applyExcerptFallback(sessionId, explorations, items);
    }
    return items;
  }, [
    sessionId,
    explorations,
    state.items,
    summaryPolicy.allowRegen,
    summaryPolicy.fillExcerptFallback,
  ]);

  const sessionIntent = useMemo((): SessionIntentState | null => {
    if (!sessionId.trim()) return null;
    return defaultSessionIntentRepository.load(sessionId);
  }, [sessionId, displayItems]);

  return {
    summaries: toExplorationSummaryTextMap(displayItems),
    flowchartHints: toExplorationFlowchartHintMap(displayItems),
    persistMeta: toExplorationPersistMetaMap(displayItems),
    pendingCount: state.pendingCount,
    cacheStatus: state.cacheStatus,
    cacheReason: state.cacheReason,
    summaryItems: displayItems,
    sessionIntent,
  };
}

export function shouldGenerateMissingSummaries(input: {
  allowRegen: boolean;
  sessionId: string;
  wikiHydratedSessionId: string;
  sessionPath: string;
}): boolean {
  if (!input.allowRegen) return false;
  if (!input.sessionId) return false;
  if (!input.sessionPath) return false;
  return input.wikiHydratedSessionId === input.sessionId;
}
