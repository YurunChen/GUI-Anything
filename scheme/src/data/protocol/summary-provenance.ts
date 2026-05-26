/**
 * Summary provenance — single entry for session-bundle hydrate vs fallback vs UI badge.
 */

import type { ExplorationCardSummary } from '../wiki/session-bundle-types';
import type {
  ExplorationId,
  SessionId,
  SummaryItem,
} from './observer-protocol';
import { makeSessionScopedId } from './observer-protocol';

export type SummaryDisplayTier = 'cache' | 'fallback';

export const SUMMARY_REASON_FROM_SESSION_BUNDLE = 'from_session_bundle' as const;
export const SUMMARY_REASON_TIMELINE_EXCERPT = 'timeline_excerpt' as const;
export const SUMMARY_REASON_LIVE_PREVIEW = 'live_preview' as const;

/** Loaded from wiki/sessions bundle — always shows cached badge. */
export function isSummaryFromSessionBundle(item: SummaryItem): boolean {
  return item.source === 'cache' || item.source === 'wiki';
}

/** Rule-based or AI-failure fallback — shows fallback badge. */
export function isSummaryFallback(item: SummaryItem): boolean {
  if (item.source === 'fallback') return true;
  if (item.source === 'excerpt') {
    return item.reason !== SUMMARY_REASON_LIVE_PREVIEW;
  }
  return false;
}

/** SUMMARY section suffix: cached (session bundle) or fallback (degraded generation). */
export function resolveSummaryDisplayTier(item: SummaryItem | undefined): SummaryDisplayTier | null {
  if (!item?.text.trim()) return null;
  if (isSummaryFromSessionBundle(item)) return 'cache';
  if (isSummaryFallback(item)) return 'fallback';
  return null;
}

/** Hydrate bundle.explorations[id].summary → SummaryItem (source always cache). */
export function summaryItemFromSessionBundle(
  sessionId: SessionId,
  explorationId: ExplorationId,
  summary: ExplorationCardSummary,
): SummaryItem {
  const id = makeSessionScopedId(sessionId, explorationId);
  return {
    id,
    sessionId,
    explorationId,
    text: summary.text,
    source: 'cache',
    status: summary.status,
    persistMeta: summary.persistMeta ?? null,
    flowchart: summary.flowchart,
    reason: SUMMARY_REASON_FROM_SESSION_BUNDLE,
  };
}

/** Persist SummaryItem → bundle card summary (ai vs fallback generation provenance). */
export function cardSummarySourceFromSummaryItem(item: SummaryItem): ExplorationCardSummary['source'] {
  return item.source === 'ai' ? 'ai' : 'fallback';
}
