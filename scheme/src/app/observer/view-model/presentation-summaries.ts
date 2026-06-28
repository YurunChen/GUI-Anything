import type { Exploration, SummaryItem } from '../../../data/protocol/observer-protocol';
import {
  resolveSummaryDisplayTier,
  SUMMARY_REASON_LIVE_PREVIEW,
  type SummaryDisplayTier,
} from '../../../data/protocol/summary-provenance';

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
