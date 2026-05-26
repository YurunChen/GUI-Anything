import type {
  Exploration,
  SessionScopedId,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import { SUMMARY_REASON_TIMELINE_EXCERPT } from '../../data/protocol/summary-provenance';

export interface SessionBannerInput {
  presentation: { mode: 'live' | 'replay' };
  explorations: Exploration[];
  summaryItems: Record<SessionScopedId, SummaryItem>;
}

export interface SessionBannerView {
  modeLine: string;
  detailLine: string;
}

export function buildSessionBanner(input: SessionBannerInput): SessionBannerView {
  if (input.presentation.mode === 'live') {
    return { modeLine: '', detailLine: '' };
  }

  const completeWithNodes = input.explorations.filter(
    (e) => e.status === 'complete' && e.nodes.length > 0,
  );

  let excerptCount = 0;

  for (const exploration of completeWithNodes) {
    const item = Object.values(input.summaryItems).find((s) => s.explorationId === exploration.id);
    if (!item?.text.trim()) continue;
    if (item.reason === SUMMARY_REASON_TIMELINE_EXCERPT) excerptCount += 1;
  }

  const covered = completeWithNodes.filter((e) =>
    Object.values(input.summaryItems).some(
      (s) => s.explorationId === e.id && s.text.trim().length > 0,
    ),
  ).length;
  const timelineOnly = completeWithNodes.length - covered;

  const parts: string[] = [];
  if (excerptCount > 0) parts.push(`${excerptCount} excerpt`);
  if (timelineOnly > 0) parts.push(`${timelineOnly} timeline-only`);

  return {
    modeLine: 'replay',
    detailLine: parts.join(' · '),
  };
}
