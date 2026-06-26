import type {
  IntentBucketLedger,
  PersistResult,
  SessionIntentState,
  SessionScopedId,
  SummaryItem,
} from '../../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../../data/protocol/observer-protocol';
import { normalizeSummaryItems } from '../../../data/protocol/summary-contract';
import { isLegacyPerTurnWikiEnabled } from '../../../services/wiki/intent-bucket-service';
import { resolveWikiPersistPhase, type WikiPersistStatus } from '../../../services/wiki/wiki-persist-policy';
import {
  DefaultWikiPersistenceService,
} from '../../../services/wiki/persistence-service';
import { DefaultInspirationNoteService } from '../../../services/wiki/inspiration-note-service';
import { WikiCurationRuntime } from '../../../services/wiki/wiki-curation-runtime';
import { resolveWikiWriteChrome } from '../view-model/wiki-write-chrome';
import type { WikiWriteChromeView } from '../view-model/wiki-write-chrome';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Exploration, InspirationRecord } from '../../../data/protocol/observer-protocol';

const SWEEP_IDLE_MS = 30_000;

interface WikiCuratorState {
  extractedCount: number;
  ledger: IntentBucketLedger | null;
  inFlightIntentKey: string | null;
  recentInspirations: InspirationRecord[];
}

export function useWikiCurator(
  explorations: Exploration[],
  summaryItems: Record<SessionScopedId, SummaryItem>,
  sessionId: string,
  sessionIntent: SessionIntentState | null,
) {
  const [state, setState] = useState<WikiCuratorState>({
    extractedCount: 0,
    ledger: null,
    inFlightIntentKey: null,
    recentInspirations: [],
  });

  const curationRuntimeRef = useRef(new WikiCurationRuntime());
  const legacyPersistRef = useRef<DefaultWikiPersistenceService | null>(null);
  const inspirationNoteServiceRef = useRef<DefaultInspirationNoteService | null>(null);
  const recordedSummariesRef = useRef(new Set<SessionScopedId>());
  const lastSessionRef = useRef('');
  const mountedRef = useRef(true);
  const lastCompleteAtRef = useRef(0);
  const sweepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!legacyPersistRef.current) {
    legacyPersistRef.current = new DefaultWikiPersistenceService();
  }
  if (!inspirationNoteServiceRef.current) {
    inspirationNoteServiceRef.current = new DefaultInspirationNoteService();
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const sid = (sessionId || '').trim();
    if (sid === lastSessionRef.current) return;
    lastSessionRef.current = sid;
    recordedSummariesRef.current.clear();
    legacyPersistRef.current!.resetSession(sid);
    const ledger = curationRuntimeRef.current.loadLedger(sid);
    if (ledger) {
      for (const bucket of Object.values(ledger.buckets)) {
        for (const explorationId of bucket.explorationIds) {
          recordedSummariesRef.current.add(makeSessionScopedId(sid, explorationId));
        }
      }
    }
    setState((prev) => ({
      extractedCount: 0,
      ledger,
      inFlightIntentKey: null,
      recentInspirations: prev.recentInspirations,
    }));
  }, [sessionId]);

  const runCurate = useCallback(async (
    intentKey: string,
    anchorExplorationId: string,
    runSessionId: string,
    items: Record<SessionScopedId, SummaryItem>,
  ) => {
    setState((prev) => ({ ...prev, inFlightIntentKey: intentKey }));
    try {
      const { result, ledger } = await curationRuntimeRef.current.curateIntent({
        sessionId: runSessionId,
        intentKey,
        anchorExplorationId,
        items,
        explorations,
      });
      if (!mountedRef.current || runSessionId !== lastSessionRef.current) return;
      const saved = result.status === 'saved' || result.status === 'updated';
      setState((prev) => ({
        ...prev,
        ledger,
        inFlightIntentKey: null,
        extractedCount: prev.extractedCount + (saved ? 1 : 0),
      }));
    } catch (error) {
      console.error('[useWikiCurator] Curate error:', error);
      if (!mountedRef.current || runSessionId !== lastSessionRef.current) return;
      setState((prev) => ({ ...prev, inFlightIntentKey: null }));
    }
  }, [explorations]);

  useEffect(() => {
    if (!sessionId) return;
    if (isLegacyPerTurnWikiEnabled()) return;

    const { items, ledger, requests } = curationRuntimeRef.current.recordReadySummaries({
      sessionId,
      explorations,
      summaryItems,
      sessionIntent,
      recordedSummaries: recordedSummariesRef.current,
    });

    for (const request of requests) {
      void runCurate(request.intentKey, request.anchorExplorationId, sessionId, items);
    }

    setState((prev) => ({ ...prev, ledger }));
  }, [explorations, summaryItems, sessionId, sessionIntent, runCurate]);

  useEffect(() => {
    if (!sessionId || isLegacyPerTurnWikiEnabled()) return;

    const allDone = explorations.length > 0
      && explorations.every((e) => e.status === 'complete' || e.status === 'interrupted');
    const items = normalizeSummaryItems(sessionId, summaryItems);
    const pendingSummary = explorations.some((e) => {
      if (e.status !== 'complete') return false;
      const scopedId = makeSessionScopedId(sessionId, e.id);
      const item = items[scopedId];
      return !item || item.status === 'pending' || !item.text?.trim();
    });

    if (allDone && !pendingSummary) {
      lastCompleteAtRef.current = Date.now();
    }

    if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);

    if (!allDone || pendingSummary) return;

    sweepTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || sessionId !== lastSessionRef.current) return;
      const idle = curationRuntimeRef.current.resolveIdleSweep({
        sessionId,
        now: Date.now(),
        lastCompleteAt: lastCompleteAtRef.current,
        idleMs: SWEEP_IDLE_MS,
      });
      if (idle.request) {
        void runCurate(idle.request.intentKey, idle.request.anchorExplorationId, sessionId, items);
      } else if (idle.ledger) {
        setState((prev) => ({
          ...prev,
          ledger: idle.ledger,
        }));
      }
    }, SWEEP_IDLE_MS + 100);

    return () => {
      if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
    };
  }, [explorations, summaryItems, sessionId, runCurate]);

  useEffect(() => {
    if (!sessionId || !isLegacyPerTurnWikiEnabled()) return;

    const items = normalizeSummaryItems(sessionId, summaryItems);
    const agentExplorationIds: Exploration['id'][] = [];

    for (const exploration of explorations) {
      const id = makeSessionScopedId(sessionId, exploration.id);
      const phase = resolveWikiPersistPhase({
        exploration,
        summaryItem: items[id],
      });
      if (phase === 'run_agent') {
        agentExplorationIds.push(exploration.id);
      }
    }

    if (agentExplorationIds.length === 0) return;

    const runSessionId = sessionId;
    legacyPersistRef.current!
      .persistCompleted({
        sessionId,
        explorations,
        summaries: items,
        onlyExplorationIds: agentExplorationIds,
      })
      .then((results) => {
        if (!mountedRef.current || runSessionId !== lastSessionRef.current) return;
        const savedCount = Object.values(results).filter(
          (r) => r.status === 'saved' || r.status === 'updated',
        ).length;
        setState((prev) => ({
          ...prev,
          extractedCount: prev.extractedCount + savedCount,
        }));
      })
      .catch((error) => {
        console.error('[useWikiCurator] Legacy persist error:', error);
      });
  }, [explorations, summaryItems, sessionId]);

  const refreshInspirations = useCallback(() => {
    setState((prev) => ({
      ...prev,
      recentInspirations: inspirationNoteServiceRef.current!.listRecentInspirations(6),
    }));
  }, []);

  useEffect(() => {
    refreshInspirations();
  }, [refreshInspirations]);

  const saveInspiration = useCallback(
    (text: string): { saved: boolean; id?: string } => {
      const result = inspirationNoteServiceRef.current!.saveInspiration(text, sessionId || undefined);
      if (result.saved) refreshInspirations();
      return result;
    },
    [refreshInspirations, sessionId],
  );

  const wikiWriteChromeByExploration = buildWikiWriteChromeMap(
    explorations,
    state.ledger,
    state.inFlightIntentKey,
  );

  const explorationPersistStatus = chromeMapToStatus(wikiWriteChromeByExploration);
  const explorationPersistResults = chromeMapToResults(wikiWriteChromeByExploration, sessionId);

  return {
    wikiExtractedCount: state.extractedCount,
    intentBucketLedger: state.ledger,
    inFlightIntentKey: state.inFlightIntentKey,
    wikiWriteChromeByExploration,
    explorationPersistStatus,
    explorationPersistResults,
    recentInspirations: state.recentInspirations,
    saveInspiration,
    refreshInspirations,
  };
}

function buildWikiWriteChromeMap(
  explorations: Exploration[],
  ledger: IntentBucketLedger | null,
  inFlightIntentKey: string | null,
): Record<string, WikiWriteChromeView> {
  const map: Record<string, WikiWriteChromeView> = {};
  for (const exploration of explorations) {
    map[exploration.id] = resolveWikiWriteChrome({
      explorationId: exploration.id,
      ledger,
      inFlightIntentKey,
    });
  }
  return map;
}

function chromeMapToStatus(
  chromeMap: Record<string, WikiWriteChromeView>,
): Record<string, WikiPersistStatus> {
  const out: Record<string, WikiPersistStatus> = {};
  for (const [id, chrome] of Object.entries(chromeMap)) {
    if (chrome.showWriteBadge && chrome.status) {
      out[id] = chrome.status;
    }
  }
  return out;
}

function chromeMapToResults(
  chromeMap: Record<string, WikiWriteChromeView>,
  sessionId: string,
): Record<string, PersistResult> {
  const out: Record<string, PersistResult> = {};
  for (const [explorationId, chrome] of Object.entries(chromeMap)) {
    if (!chrome.showWriteBadge || !chrome.status) continue;
    out[explorationId] = {
      id: makeSessionScopedId(sessionId, explorationId),
      status: chrome.status === 'pending' ? 'skipped' : chrome.status,
      reason: chrome.result?.reason,
      path: chrome.result?.path,
    };
  }
  return out;
}
