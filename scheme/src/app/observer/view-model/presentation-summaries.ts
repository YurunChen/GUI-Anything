import type { Exploration, SessionScopedId, SummaryItem } from '../../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../../data/protocol/observer-protocol';
import { buildExplorationExcerptSummary } from '../../../services/ai/exploration-excerpt';
import { buildLiveSummaryPreview, buildLiveSummaryPreviewFlowchart } from './live-summary-preview';

export type SummaryDisplayTier = 'ai' | 'cache' | 'stale' | 'wiki' | 'excerpt' | 'fallback';

/** True while the card should show the summarizing animation (not Claude round-record placeholder). */
export function isExplorationSummarizing(
  exploration: Exploration,
  summaryItem: SummaryItem | undefined,
  pendingSummaryCount: number,
): boolean {
  if (exploration.status !== 'complete' || exploration.nodes.length === 0) return false;
  if (
    summaryItem?.source === 'ai'
    && summaryItem.status === 'ready'
    && Boolean(summaryItem.text?.trim())
  ) {
    return false;
  }
  if (summaryItem?.reason === 'live_preview') return true;
  if (!summaryItem?.text?.trim() && pendingSummaryCount > 0) return true;
  return false;
}

export function resolveSummaryDisplayTier(item: SummaryItem | undefined): SummaryDisplayTier | null {
  if (!item?.text.trim()) return null;
  if (item.reason === 'jsonl_modified_since_cache') return 'stale';
  switch (item.source) {
    case 'ai':
      return 'ai';
    case 'cache':
      return 'cache';
    case 'wiki':
      return 'wiki';
    case 'excerpt':
      return 'excerpt';
    case 'fallback':
      return null;
    default:
      return null;
  }
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
      source: 'excerpt',
      status: 'ready',
      persistMeta: existing?.persistMeta ?? null,
      flowchart: existing?.flowchart,
      reason: 'timeline_excerpt',
    };
  }
  return next;
}

/** Live: show rule-based Hero until Summary Agent returns (avoids question-only cards). */
export function applyLiveSummaryPreview(
  sessionId: string,
  explorations: Exploration[],
  items: Record<SessionScopedId, SummaryItem>,
): Record<SessionScopedId, SummaryItem> {
  if (!sessionId.trim()) return items;

  const next = { ...items };
  for (const exploration of explorations) {
    if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
    const id = makeSessionScopedId(sessionId, exploration.id);
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
      reason: 'live_preview',
    };
  }
  return next;
}
