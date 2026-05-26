/**
 * useExplorationSummaries — hydrate bundle → derive runtime phase → generate gaps (live).
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type {
  Exploration,
  SessionScopedId,
  SummaryItem,
} from '../../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../../data/protocol/observer-protocol';
import type { ExplorationId } from '../../../data/protocol/observer-protocol';
import type { SessionBindingIntent } from '../../../services/session/session-binding-policy';
import type { SessionRuntime } from '../../../services/session/session-runtime-policy';
import {
  buildGenerateTriggerKey,
  getSummaryOrchestrator,
  shouldGenerateMissingSummaries,
} from '../../../services/ai/summary-orchestrator';
import { createLogger } from '../../../utils/logger';
import { applyExcerptFallback, applyLiveSummaryPreview } from '../view-model/presentation-summaries';
import {
  toExplorationFlowchartHintMap,
  toExplorationPersistMetaMap,
  toExplorationSummaryTextMap,
} from '../../../data/protocol/summary-contract';
import { useSessionIntent } from './useSessionIntent';

const log = createLogger('summary');
const runtimeLog = createLogger('runtime');

interface SummaryState {
  items: Record<SessionScopedId, SummaryItem>;
  pendingCount: number;
  summariesReadyKey: string;
  bundleSummaryByExplorationId: Record<string, boolean>;
}

export function useExplorationSummaries(
  explorations: Exploration[],
  sessionId: string,
  sessionPath: string,
  summaryModel: string | undefined,
  bindingIntent: SessionBindingIntent,
  wikiBundleHasData: boolean,
  sessionBound: boolean,
) {
  const [state, setState] = useState<SummaryState>({
    items: {},
    pendingCount: 0,
    summariesReadyKey: '',
    bundleSummaryByExplorationId: {},
  });

  const summaryModelRef = useRef(summaryModel);
  summaryModelRef.current = summaryModel;

  const itemsRef = useRef(state.items);
  itemsRef.current = state.items;
  const bundleSummaryRef = useRef(state.bundleSummaryByExplorationId);
  bundleSummaryRef.current = state.bundleSummaryByExplorationId;

  const orchestratorRef = useRef(getSummaryOrchestrator());
  const lastSessionRef = useRef('');
  const lastHydrateKeyRef = useRef('');
  const mountedRef = useRef(true);
  const lastRuntimeKeyRef = useRef('');

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const sid = (sessionId || '').trim();
    const path = (sessionPath || '').trim();
    const hydrateKey = sid && path ? `${sid}|${path}` : '';

    if (sid !== lastSessionRef.current) {
      lastSessionRef.current = sid;
      lastHydrateKeyRef.current = '';
      const reset = orchestratorRef.current.resetSession(sid);
      itemsRef.current = reset.items;
      bundleSummaryRef.current = reset.bundleSummaryByExplorationId;
      setState(reset);
    }

    if (!hydrateKey || hydrateKey === lastHydrateKeyRef.current) return;

    let cancelled = false;
    const orchestrator = orchestratorRef.current;

    void (async () => {
      log.debug('hydrate started', { sessionId: sid, sessionPath: path });
      const hydrated = orchestrator.hydrate(sid, path);
      if (cancelled) return;

      lastHydrateKeyRef.current = hydrateKey;
      log.info('bundle hydrated', {
        sessionId: sid,
        itemCount: Object.keys(hydrated.items).length,
      });
      itemsRef.current = hydrated.items;
      bundleSummaryRef.current = hydrated.bundleSummaryByExplorationId;
      setState((prev) => ({
        ...prev,
        items: hydrated.items,
        summariesReadyKey: hydrated.summariesReadyKey,
        bundleSummaryByExplorationId: hydrated.bundleSummaryByExplorationId,
      }));
    })().catch((error) => {
      if (cancelled) return;
      log.error('hydrate failed', {
        sessionId: sid,
        error: error instanceof Error ? error.message : String(error),
      });
      lastHydrateKeyRef.current = hydrateKey;
      setState((prev) => ({ ...prev, summariesReadyKey: hydrateKey }));
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId, sessionPath]);

  const runtime = useMemo((): SessionRuntime => {
    return orchestratorRef.current.deriveRuntime({
      intent: bindingIntent,
      sessionId,
      sessionBound,
      explorations,
      summaryItems: state.items,
      wikiBundleHasData,
    });
  }, [
    bindingIntent,
    sessionId,
    sessionBound,
    explorations,
    state.items,
    wikiBundleHasData,
  ]);

  useEffect(() => {
    const sid = sessionId.trim();
    if (!sid) return;
    const runtimeKey = `${runtime.phase}:${runtime.visibility}:${runtime.hasMissingSummaries}:${bindingIntent.mode}`;
    if (runtimeKey === lastRuntimeKeyRef.current) return;
    lastRuntimeKeyRef.current = runtimeKey;
    runtimeLog.info('runtime updated', {
      sessionId: sid,
      phase: runtime.phase,
      visibility: runtime.visibility,
      needSummary: runtime.hasMissingSummaries,
      bindingMode: bindingIntent.mode,
      bundleData: wikiBundleHasData,
      explorations: explorations.length,
    });
  }, [
    sessionId,
    runtime.phase,
    runtime.visibility,
    runtime.hasMissingSummaries,
    bindingIntent.mode,
    wikiBundleHasData,
    explorations.length,
  ]);

  const { presentation } = runtime;

  const generateTriggerKey = useMemo(
    () => buildGenerateTriggerKey(explorations),
    [explorations],
  );

  useEffect(() => {
    const orchestrator = orchestratorRef.current;
    const service = orchestrator.service;

    if (!shouldGenerateMissingSummaries({
      allowRegen: presentation.allowSummaryRegen,
      sessionId,
      summariesReadyKey: state.summariesReadyKey,
      sessionPath,
    })) {
      setState((prev) => ({ ...prev, pendingCount: 0 }));
      return;
    }

    const pendingInFlight = service.pendingCount();
    if (pendingInFlight > 0) {
      setState((prev) => (
        prev.pendingCount === pendingInFlight ? prev : { ...prev, pendingCount: pendingInFlight }
      ));
      return;
    }

    if (!orchestrator.shouldRunGenerate({
      allowRegen: presentation.allowSummaryRegen,
      sessionId,
      summariesReadyKey: state.summariesReadyKey,
      sessionPath,
      explorations,
      items: itemsRef.current,
    })) {
      setState((prev) => ({ ...prev, pendingCount: 0 }));
      return;
    }

    log.info('generate started', {
      sessionId,
      explorations: explorations.length,
      trigger: generateTriggerKey || 'none',
    });
    const runSessionId = sessionId;
    const runSessionPath = sessionPath;
    const existingSnapshot = { ...itemsRef.current };
    const priorFlags = { ...bundleSummaryRef.current };

    setState((prev) => ({
      ...prev,
      pendingCount: service.pendingCount(),
    }));

    void service.generateMissing({
      sessionId,
      explorations,
      jsonlPath: sessionPath,
      existing: existingSnapshot,
      summaryModel: summaryModelRef.current,
    })
      .then(async (generatedItems) => {
        if (!mountedRef.current) return;
        if (runSessionId !== lastSessionRef.current) return;

        const finished = await orchestrator.finishGenerate({
          sessionId: runSessionId,
          sessionPath: runSessionPath,
          existing: existingSnapshot,
          generatedItems,
          priorBundleSummaryFlags: priorFlags,
        });

        itemsRef.current = finished.items;
        bundleSummaryRef.current = finished.bundleSummaryByExplorationId;
        log.info('generate finished', {
          sessionId: runSessionId,
          generated: Object.keys(generatedItems).length,
          pending: finished.pendingCount,
          items: Object.keys(finished.items).length,
        });
        setState((prev) => ({
          ...prev,
          items: finished.items,
          pendingCount: finished.pendingCount,
          bundleSummaryByExplorationId: finished.bundleSummaryByExplorationId,
        }));
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        if (runSessionId !== lastSessionRef.current) return;
        log.error('generate missing summaries failed', {
          sessionId: runSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        setState((prev) => ({
          ...prev,
          pendingCount: orchestrator.service.pendingCount(),
        }));
      });
  }, [
    generateTriggerKey,
    sessionId,
    state.summariesReadyKey,
    sessionPath,
    presentation.allowSummaryRegen,
    explorations,
  ]);

  const displayItems = useMemo(() => {
    let items = state.items;
    if (presentation.allowSummaryRegen) {
      items = applyLiveSummaryPreview(
        sessionId,
        explorations,
        items,
        state.bundleSummaryByExplorationId,
      );
    }
    if (presentation.fillExcerptFallback) {
      items = applyExcerptFallback(sessionId, explorations, items);
    }
    return items;
  }, [
    sessionId,
    explorations,
    state.items,
    state.bundleSummaryByExplorationId,
    presentation.allowSummaryRegen,
    presentation.fillExcerptFallback,
  ]);

  const sessionIntent = useSessionIntent(sessionId, displayItems);

  const pendingByExplorationId = useMemo((): Record<ExplorationId, boolean> => {
    const service = orchestratorRef.current.service;
    const sid = sessionId.trim();
    if (!sid) return {};
    const out: Record<ExplorationId, boolean> = {};
    for (const exploration of explorations) {
      const scopedId = makeSessionScopedId(sid, exploration.id);
      out[exploration.id] = service.isExplorationPending(scopedId);
    }
    return out;
  }, [sessionId, explorations, state.pendingCount]);

  return {
    summaries: toExplorationSummaryTextMap(displayItems),
    flowchartHints: toExplorationFlowchartHintMap(displayItems),
    persistMeta: toExplorationPersistMetaMap(displayItems),
    pendingCount: state.pendingCount,
    pendingByExplorationId,
    summaryItems: displayItems,
    sessionIntent,
    runtime,
  };
}

export { buildGenerateTriggerKey, shouldGenerateMissingSummaries };
export { hasMissingSummaries } from '../../../services/ai/summary-orchestrator';
