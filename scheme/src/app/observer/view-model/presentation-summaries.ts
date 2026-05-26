import type { Exploration, SessionScopedId, SummaryItem } from '../../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../../data/protocol/observer-protocol';
import {
  resolveSummaryDisplayTier,
  SUMMARY_REASON_LIVE_PREVIEW,
  SUMMARY_REASON_TIMELINE_EXCERPT,
  type SummaryDisplayTier,
} from '../../../data/protocol/summary-provenance';
import { buildExplorationExcerptSummary } from '../../../services/ai/exploration-excerpt';
import { buildLiveSummaryPreview, buildLiveSummaryPreviewFlowchart } from './live-summary-preview';

export type { SummaryDisplayTier };
export { resolveSummaryDisplayTier };

/** True while Summary Agent is running for this exploration only. */
export function isExplorationSummarizing(
  exploration: Exploration,
  summaryItem: SummaryItem | undefined,
  isPendingForExploration: boolean,
): boolean {
  if (exploration.status !== 'complete' || exploration.nodes.length === 0) return false;
  if (summaryItem?.status === 'ready' && Boolean(summaryItem.text?.trim())) {
    if (summaryItem.reason !== SUMMARY_REASON_LIVE_PREVIEW) return false;
  }
  if (!isPendingForExploration) return false;
  return true;
}

/** Replay: add rule-based excerpt for complete explorations without any summary text. */
export function applyExcerptFallback(
  sessionId: string,
  explorations: Exploration[],
  items: Record<SessionScopedId, SummaryItem>,
): Record<SessionScopedId, SummaryItem> {
  if (!sessionId.trim()) return items;

  const next = { ...items };
  for (const exploration of explorations) {
    if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
    const id = makeSessionScopedId(sessionId, exploration.id);
    const existing = next[id];
    if (existing?.text.trim()) continue;

    const text = buildExplorationExcerptSummary(exploration.question, exploration.nodes);
    next[id] = {
      id,
      sessionId,
      explorationId: exploration.id,
      text,
      source: 'fallback',
      status: 'ready',
      persistMeta: existing?.persistMeta ?? null,
      flowchart: existing?.flowchart,
      reason: SUMMARY_REASON_TIMELINE_EXCERPT,
    };
  }
  return next;
}

/** Live: show rule-based Hero until Summary Agent returns (avoids question-only cards). */
export function applyLiveSummaryPreview(
  sessionId: string,
  explorations: Exploration[],
  items: Record<SessionScopedId, SummaryItem>,
  hasBundleSummaryByExplorationId: Record<string, boolean> = {},
): Record<SessionScopedId, SummaryItem> {
  if (!sessionId.trim()) return items;

  const next = { ...items };
  for (const exploration of explorations) {
    if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
    const id = makeSessionScopedId(sessionId, exploration.id);
    if (hasBundleSummaryByExplorationId[exploration.id]) continue;
    if (next[id]?.text.trim()) continue;

    const text = buildLiveSummaryPreview(exploration);
    const previewFlowchart = buildLiveSummaryPreviewFlowchart(exploration);
    next[id] = {
      id,
      sessionId,
      explorationId: exploration.id,
      text,
      source: 'excerpt',
      status: 'ready',
      persistMeta: next[id]?.persistMeta ?? null,
      flowchart: next[id]?.flowchart ?? previewFlowchart,
      reason: SUMMARY_REASON_LIVE_PREVIEW,
    };
  }
  return next;
}
