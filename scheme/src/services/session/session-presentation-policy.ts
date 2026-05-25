import type {
  Exploration,
  SessionScopedId,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import type { SessionBindingIntent } from './session-binding-policy';
import { deriveSessionSummaryPolicy } from './session-binding-policy';

export type SessionPresentationMode = 'live' | 'replay';

export interface SessionPresentationPolicy {
  mode: SessionPresentationMode;
  allowSummaryRegen: boolean;
  /** Replay: return stale cache instead of deleting. Live: clear expired cache. */
  preserveStaleCache: boolean;
  /** Replay: fill missing complete explorations with L1 excerpt from JSONL nodes. */
  fillExcerptFallback: boolean;
}

export function deriveSessionPresentationPolicy(intent: SessionBindingIntent): SessionPresentationPolicy {
  const summaryPolicy = deriveSessionSummaryPolicy(intent);
  const replay = !summaryPolicy.allowRegen;
  return {
    mode: replay ? 'replay' : 'live',
    allowSummaryRegen: summaryPolicy.allowRegen,
    preserveStaleCache: replay,
    fillExcerptFallback: replay,
  };
}

export interface SessionBannerInput {
  presentation: SessionPresentationPolicy;
  explorations: Exploration[];
  summaryItems: Record<SessionScopedId, SummaryItem>;
}

export interface SessionBannerView {
  /** Short mode line for status / replay chrome */
  modeLine: string;
  /** Optional detail (tier counts); empty when nothing to report */
  detailLine: string;
}

export function buildSessionBanner(input: SessionBannerInput): SessionBannerView {
  if (input.presentation.mode === 'live') {
    return { modeLine: '', detailLine: '' };
  }

  const completeWithNodes = input.explorations.filter(
    (e) => e.status === 'complete' && e.nodes.length > 0,
  );

  let staleCount = 0;
  let excerptCount = 0;

  for (const exploration of completeWithNodes) {
    const item = Object.values(input.summaryItems).find((s) => s.explorationId === exploration.id);
    if (!item?.text.trim()) continue;
    if (item.reason === 'jsonl_modified_since_cache') staleCount += 1;
    else if (item.source === 'excerpt') excerptCount += 1;
  }

  const covered = completeWithNodes.filter((e) =>
    Object.values(input.summaryItems).some(
      (s) => s.explorationId === e.id && s.text.trim().length > 0,
    ),
  ).length;
  const timelineOnly = completeWithNodes.length - covered;

  const parts: string[] = [];
  if (staleCount > 0) parts.push(`${staleCount} stale`);
  if (excerptCount > 0) parts.push(`${excerptCount} excerpt`);
  if (timelineOnly > 0) parts.push(`${timelineOnly} timeline-only`);

  return {
    modeLine: 'replay',
    detailLine: parts.join(' · '),
  };
}
