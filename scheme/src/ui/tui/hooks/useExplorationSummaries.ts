/**
 * useExplorationSummaries - 探索摘要生成与管理
 * 职责：管理 exploration summaries 的生成、缓存、wiki 回填
 */

import { useState, useEffect, useRef } from 'react';
import { generateExplorationSummaryAI } from '../../../core/flow-summaries';
import { loadWikiSummariesBySession } from '../../../runtime/wiki-auto-extractor';
import type { Exploration } from '../../../runtime/posthoc';
import type { WikiPersistMeta } from '../../../runtime/wiki-auto-extractor';

interface SummaryState {
  summaries: Record<string, string>;
  persistMeta: Record<string, WikiPersistMeta | null>;
  pendingCount: number;
}

export function useExplorationSummaries(
  explorations: Exploration[],
  sessionId: string,
  summaryModel?: string
) {
  const [state, setState] = useState<SummaryState>({
    summaries: {},
    persistMeta: {},
    pendingCount: 0,
  });

  const summaryModelRef = useRef(summaryModel);
  summaryModelRef.current = summaryModel;

  const summariesRef = useRef(state.summaries);
  summariesRef.current = state.summaries;

  const pendingRef = useRef<Set<string>>(new Set());
  const lastSessionRef = useRef<string>('');
  const wikiHydratedSessionRef = useRef<string>('');
  const wikiHydratedIdsRef = useRef<Set<string>>(new Set());

  // Session is the source-of-truth boundary: clear in-memory caches on switch
  // to avoid exp_1/exp_2 key collisions across different sessions.
  useEffect(() => {
    const sid = (sessionId || '').trim();
    if (sid === lastSessionRef.current) return;
    lastSessionRef.current = sid;
    wikiHydratedSessionRef.current = '';
    wikiHydratedIdsRef.current.clear();
    pendingRef.current.clear();
    setState({
      summaries: {},
      persistMeta: {},
      pendingCount: 0,
    });
  }, [sessionId]);

  // Load wiki summaries for current session
  useEffect(() => {
    if (!sessionId) return;
    const wikiSummaries = loadWikiSummariesBySession(sessionId);
    wikiHydratedIdsRef.current = new Set(Object.keys(wikiSummaries));
    setState((prev) => ({
      ...prev,
      summaries: Object.keys(wikiSummaries).length > 0
        ? { ...prev.summaries, ...wikiSummaries }
        : prev.summaries,
    }));
    wikiHydratedSessionRef.current = sessionId;
  }, [sessionId]);

  // Generate summaries for complete explorations
  useEffect(() => {
    if (!sessionId || wikiHydratedSessionRef.current !== sessionId) {
      return;
    }
    for (const exploration of explorations) {
      if (exploration.status !== 'complete') continue;
      if (wikiHydratedIdsRef.current.has(exploration.id)) continue;
      if (summariesRef.current[exploration.id]) continue;
      if (pendingRef.current.has(exploration.id)) continue;
      if (exploration.nodes.length === 0) continue;

      pendingRef.current.add(exploration.id);
      setState((prev) => ({ ...prev, pendingCount: pendingRef.current.size }));

      const id = exploration.id;
      const history = buildHistoryContext(explorations, exploration.id, summariesRef.current);

      generateExplorationSummaryAI(
        exploration.question,
        exploration.nodes,
        history,
        summaryModelRef.current || undefined
      )
        .then((payload) => {
          setState((prev) => ({
            summaries: { ...prev.summaries, [id]: payload.displaySummary },
            persistMeta: { ...prev.persistMeta, [id]: payload.persist },
            pendingCount: prev.pendingCount,
          }));
        })
        .catch(() => {
          setState((prev) => ({
            summaries: { ...prev.summaries, [id]: '（摘要生成失败）' },
            persistMeta: { ...prev.persistMeta, [id]: null },
            pendingCount: prev.pendingCount,
          }));
        })
        .finally(() => {
          pendingRef.current.delete(id);
          setState((prev) => ({ ...prev, pendingCount: pendingRef.current.size }));
        });
    }
  }, [explorations]);

  return {
    summaries: state.summaries,
    persistMeta: state.persistMeta,
    pendingCount: state.pendingCount,
  };
}

function buildHistoryContext(
  explorations: Exploration[],
  currentId: string,
  summaries: Record<string, string>
): Array<{ question: string; summary?: string; toolCount: number; errorCount: number; status: 'complete' | 'interrupted' }> {
  const idx = explorations.findIndex((e) => e.id === currentId);
  return explorations
    .slice(Math.max(0, idx - 3), idx)
    .filter((item) => item.status === 'complete' || item.status === 'interrupted')
    .map((item) => ({
      question: item.question,
      summary: summaries[item.id],
      toolCount: item.nodes.filter((n) => n.type === 'tool').length,
      errorCount: item.nodes.filter((n) => n.type === 'error' || n.status === 'error').length,
      status: item.status === 'interrupted' ? 'interrupted' : ('complete' as const),
    }));
}
