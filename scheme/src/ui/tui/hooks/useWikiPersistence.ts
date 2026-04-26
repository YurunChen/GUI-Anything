/**
 * useWikiPersistence - Wiki 自动提取与笔记管理
 * 职责：自动提取 exploration 到 wiki、管理 notes 列表
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  autoExtractAndSave,
  loadWikiSummariesBySession,
  listRecentInspirationNotes,
  saveInspirationNote,
  type ExplorationSummary,
  type InspirationRecord,
  type WikiPersistMeta,
} from '../../../runtime/wiki-auto-extractor';
import type { Exploration } from '../../../runtime/posthoc';
import { extractCommandsFromNodes, extractPathsFromNodes } from '../flow/flow-utils';

interface WikiState {
  extractedCount: number;
  persistStatus: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
  recentInspirations: InspirationRecord[];
}

export function useWikiPersistence(
  explorations: Exploration[],
  summaries: Record<string, string>,
  persistMeta: Record<string, WikiPersistMeta | null>,
  sessionId: string
) {
  const [state, setState] = useState<WikiState>({
    extractedCount: 0,
    persistStatus: {},
    recentInspirations: [],
  });

  const extractedIds = useRef<Set<string>>(new Set());
  const lastSessionRef = useRef<string>('');

  // Reset session-scoped persistence state to prevent cross-session leakage
  // when exploration IDs repeat (e.g. exp_1 in every session).
  useEffect(() => {
    const sid = (sessionId || '').trim();
    if (sid === lastSessionRef.current) return;
    lastSessionRef.current = sid;
    extractedIds.current.clear();
    setState((prev) => ({
      extractedCount: 0,
      persistStatus: {},
      recentInspirations: prev.recentInspirations,
    }));
  }, [sessionId]);

  // Hydrate already persisted explorations from wiki on session switch,
  // so resume won't re-run extraction logic for the same items.
  useEffect(() => {
    if (!sessionId) return;
    const persisted = loadWikiSummariesBySession(sessionId);
    const ids = Object.keys(persisted);
    if (ids.length === 0) return;
    setState((prev) => {
      const nextStatus = { ...prev.persistStatus };
      for (const id of ids) {
        extractedIds.current.add(id);
        nextStatus[id] = 'saved';
      }
      return { ...prev, persistStatus: nextStatus };
    });
  }, [sessionId]);

  // Auto-extract to wiki
  useEffect(() => {
    for (const exploration of explorations) {
      if (exploration.status !== 'complete') continue;
      if (extractedIds.current.has(exploration.id)) continue;

      const displaySummary = summaries[exploration.id]?.trim();
      if (!displaySummary) continue;

      setState((prev) => ({
        ...prev,
        persistStatus: { ...prev.persistStatus, [exploration.id]: 'pending' },
      }));

      const meta = persistMeta[exploration.id];
      const summary: ExplorationSummary = {
        id: exploration.id,
        request: exploration.question,
        summary: displaySummary,
        commands: extractCommandsFromNodes(exploration.nodes),
        files: extractPathsFromNodes(exploration.nodes),
        nodes: exploration.nodes.map((node) => ({
          timestamp: node.timestamp,
          type: node.type,
          label: node.rawText || node.label,
          status: node.status,
          phase: node.phase,
          rawCommand: node.rawCommand,
        })),
        result: 'success',
        duration: 0,
        tokens: 0,
        sessionId,
        persistMeta: meta === undefined ? null : meta,
      };

      const result = autoExtractAndSave(summary);
      if (result.saved) {
        extractedIds.current.add(exploration.id);
        setState((prev) => ({
          ...prev,
          extractedCount: prev.extractedCount + 1,
          persistStatus: { ...prev.persistStatus, [exploration.id]: 'saved' },
        }));
      } else if (meta && meta.should_persist === false) {
        extractedIds.current.add(exploration.id);
        setState((prev) => ({
          ...prev,
          persistStatus: { ...prev.persistStatus, [exploration.id]: 'skipped' },
        }));
      } else {
        setState((prev) => ({
          ...prev,
          persistStatus: { ...prev.persistStatus, [exploration.id]: 'failed' },
        }));
      }
    }
  }, [explorations, summaries, persistMeta, sessionId]);

  // Refresh inspirations
  const refreshInspirations = useCallback(() => {
    setState((prev) => ({
      ...prev,
      recentInspirations: listRecentInspirationNotes(6),
    }));
  }, []);

  useEffect(() => {
    refreshInspirations();
  }, [refreshInspirations]);

  // Save inspiration note
  const saveInspiration = useCallback(
    (text: string): { saved: boolean; id?: string } => {
      const result = saveInspirationNote(text);
      if (result.saved) {
        refreshInspirations();
      }
      return result;
    },
    [refreshInspirations]
  );

  return {
    wikiExtractedCount: state.extractedCount,
    explorationPersistStatus: state.persistStatus,
    recentInspirations: state.recentInspirations,
    saveInspiration,
    refreshInspirations,
  };
}
