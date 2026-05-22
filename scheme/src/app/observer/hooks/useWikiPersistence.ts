/**
 * useWikiPersistence - application adapter for wiki persistence and notes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Exploration,
  WikiPersistMeta,
  PersistResult,
  SessionScopedId,
  SummaryItem,
  InspirationRecord,
} from '../../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../../data/protocol/observer-protocol';
import {
  DefaultWikiPersistenceService,
} from '../../../services/wiki/persistence-service';
import { DefaultInspirationNoteService } from '../../../services/wiki/inspiration-note-service';

interface WikiState {
  extractedCount: number;
  /** Full persist results with reasons for UI badges */
  persistResults: Record<SessionScopedId, PersistResult>;
  persistStatus: Record<SessionScopedId, 'saved' | 'skipped' | 'failed' | 'pending'>;
  recentInspirations: InspirationRecord[];
}

export function useWikiPersistence(
  explorations: Exploration[],
  summaries: Record<string, string>,
  persistMeta: Record<string, WikiPersistMeta | null>,
  sessionId: string,
) {
  const [state, setState] = useState<WikiState>({
    extractedCount: 0,
    persistResults: {},
    persistStatus: {},
    recentInspirations: [],
  });

  const wikiPersistenceServiceRef = useRef<DefaultWikiPersistenceService | null>(null);
  const inspirationNoteServiceRef = useRef<DefaultInspirationNoteService | null>(null);
  if (!wikiPersistenceServiceRef.current) {
    wikiPersistenceServiceRef.current = new DefaultWikiPersistenceService();
  }
  if (!inspirationNoteServiceRef.current) {
    inspirationNoteServiceRef.current = new DefaultInspirationNoteService();
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
    wikiPersistenceServiceRef.current!.resetSession(sid);
    setState((prev) => ({
      extractedCount: 0,
      persistResults: {},
      persistStatus: {},
      recentInspirations: prev.recentInspirations,
    }));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    wikiPersistenceServiceRef.current!
      .hydratePersisted(sessionId)
      .then((results) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          persistResults: {
            ...prev.persistResults,
            ...results,
          },
          persistStatus: {
            ...prev.persistStatus,
            ...toStatusMap(results),
          },
        }));
      })
      .catch((error) => {
        console.error('[useWikiPersistence] Hydrate error:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const summaryItems = toSummaryItems(sessionId, summaries, persistMeta);
    const pendingIds: SessionScopedId[] = [];
    for (const exploration of explorations) {
      if (exploration.status !== 'complete') continue;
      const id = makeSessionScopedId(sessionId, exploration.id);
      if (!summaryItems[id] || state.persistStatus[id]) continue;
      pendingIds.push(id);
    }
    if (pendingIds.length === 0) return;

    const runSessionId = sessionId;
    setState((prev) => {
      const nextStatus = { ...prev.persistStatus };
      for (const id of pendingIds) nextStatus[id] = 'pending';
      return { ...prev, persistStatus: nextStatus };
    });
    wikiPersistenceServiceRef.current!
      .persistCompleted({
        sessionId,
        explorations,
        summaries: summaryItems,
      })
      .then((results) => {
        // explorations/status updates can re-run this effect frequently.
        // Keep successful writes as long as the component is alive and session is unchanged.
        if (!mountedRef.current) return;
        if (runSessionId !== lastSessionRef.current) return;
        const savedCount = Object.values(results).filter((result) => result.status === 'saved').length;
        setState((prev) => ({
          ...prev,
          extractedCount: prev.extractedCount + savedCount,
          persistResults: {
            ...prev.persistResults,
            ...results,
          },
          persistStatus: {
            ...prev.persistStatus,
            ...toStatusMap(results),
          },
        }));
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        if (runSessionId !== lastSessionRef.current) return;
        console.error('[useWikiPersistence] Persist error:', error);
      });
  }, [explorations, summaries, persistMeta, sessionId, state.persistStatus]);

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
      if (result.saved) {
        refreshInspirations();
      }
      return result;
    },
    [refreshInspirations, sessionId],
  );

  return {
    wikiExtractedCount: state.extractedCount,
    explorationPersistStatus: toExplorationStatusMap(state.persistStatus),
    explorationPersistResults: toExplorationResultsMap(state.persistResults),
    recentInspirations: state.recentInspirations,
    saveInspiration,
    refreshInspirations,
  };
}

function toSummaryItems(
  sessionId: string,
  summaries: Record<string, string>,
  persistMeta: Record<string, WikiPersistMeta | null>,
): Record<SessionScopedId, SummaryItem> {
  const items: Record<SessionScopedId, SummaryItem> = {};
  for (const [explorationId, text] of Object.entries(summaries)) {
    const id = makeSessionScopedId(sessionId, explorationId);
    items[id] = {
      id,
      sessionId,
      explorationId,
      text,
      source: 'ai',
      status: 'ready',
      persistMeta: persistMeta[explorationId] ?? null,
    };
  }
  return items;
}

function toStatusMap(
  results: Record<SessionScopedId, PersistResult>,
): Record<SessionScopedId, 'saved' | 'skipped' | 'failed'> {
  const status: Record<SessionScopedId, 'saved' | 'skipped' | 'failed'> = {};
  for (const [id, result] of Object.entries(results) as Array<[SessionScopedId, PersistResult]>) {
    status[id] = result.status;
  }
  return status;
}

function toExplorationStatusMap(
  status: Record<SessionScopedId, 'saved' | 'skipped' | 'failed' | 'pending'>,
): Record<string, 'saved' | 'skipped' | 'failed' | 'pending'> {
  const output: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'> = {};
  for (const [id, value] of Object.entries(status) as Array<[SessionScopedId, 'saved' | 'skipped' | 'failed' | 'pending']>) {
    output[id.slice(id.indexOf(':') + 1)] = value;
  }
  return output;
}

function toExplorationResultsMap(
  results: Record<SessionScopedId, PersistResult>,
): Record<string, PersistResult> {
  const output: Record<string, PersistResult> = {};
  for (const [id, result] of Object.entries(results) as Array<[SessionScopedId, PersistResult]>) {
    output[id.slice(id.indexOf(':') + 1)] = result;
  }
  return output;
}
