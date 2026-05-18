/**
 * useExplorationSummaries - application adapter for summary generation.
 */

import { useState, useEffect, useRef } from 'react';
import type {
  Exploration,
  WikiPersistMeta,
  SessionScopedId,
  SummaryItem,
  CacheLoadStatus,
  FlowchartHint,
} from '../../../data/protocol/observer-protocol';
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

export interface SummaryGenerationPolicy {
  allowRegen: boolean;
}

export function useExplorationSummaries(
  explorations: Exploration[],
  sessionId: string,
  sessionPath: string,
  summaryModel?: string,
  summaryPolicy: SummaryGenerationPolicy = { allowRegen: true },
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

    // Try to load from cache immediately on session change
    if (sid && sessionPath) {
      const cached = summaryServiceRef.current!.hydrateFromCache(sid, sessionPath);
      setState((prev) => ({
        ...prev,
        items: Object.keys(cached.items).length > 0
          ? { ...prev.items, ...cached.items }
          : prev.items,
        cacheStatus: cached.cacheStatus,
        cacheReason: cached.cacheReason,
      }));
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
        if (cancelled) return;
        console.error('[useExplorationSummaries] Hydrate error:', error);
        // Degrade gracefully: allow AI generation path to proceed even if wiki hydration fails.
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
        // Keep results if still mounted and same session.
        // exploration updates can re-run this effect frequently; those should not drop completed results.
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

  return {
    summaries: toExplorationSummaryMap(state.items),
    flowchartHints: toExplorationFlowchartHintMap(state.items),
    persistMeta: toExplorationPersistMetaMap(state.items),
    pendingCount: state.pendingCount,
    // Provenance for UI badges
    cacheStatus: state.cacheStatus,
    cacheReason: state.cacheReason,
    // Full items for source/reason access
    summaryItems: state.items,
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

function toExplorationFlowchartHintMap(
  items: Record<SessionScopedId, SummaryItem>,
): Record<string, FlowchartHint> {
  const hints: Record<string, FlowchartHint> = {};
  for (const item of Object.values(items)) {
    if (!item.flowchart) continue;
    hints[item.explorationId] = item.flowchart;
  }
  return hints;
}
