import type { PersistResult } from '../../../data/protocol/observer-protocol';
import type { WikiPersistStatus } from '../../../services/wiki/wiki-persist-policy';

export interface WikiStatusCounts {
  saved: number;
  updated: number;
  pending: number;
  skipped: number;
  failed: number;
}

export function countWikiStatuses(
  status: Record<string, WikiPersistStatus>,
): WikiStatusCounts {
  const counts: WikiStatusCounts = {
    saved: 0,
    updated: 0,
    pending: 0,
    skipped: 0,
    failed: 0,
  };
  for (const value of Object.values(status)) {
    counts[value] += 1;
  }
  return counts;
}

export function hasWikiStatusActivity(counts: WikiStatusCounts): boolean {
  return counts.saved + counts.updated + counts.pending + counts.skipped + counts.failed > 0;
}

/** Compact session line: `wiki 1 saved · 1 pending · 2 skipped` */
export function formatWikiStatusLine(
  counts: WikiStatusCounts,
  labels: {
    saved: string;
    updated: string;
    pending: string;
    skipped: string;
    failed: string;
  },
): string | null {
  if (!hasWikiStatusActivity(counts)) return null;

  const parts: string[] = [];
  if (counts.saved > 0) parts.push(`${counts.saved} ${labels.saved}`);
  if (counts.updated > 0) parts.push(`${counts.updated} ${labels.updated}`);
  if (counts.pending > 0) parts.push(`${counts.pending} ${labels.pending}`);
  if (counts.skipped > 0) parts.push(`${counts.skipped} ${labels.skipped}`);
  if (counts.failed > 0) parts.push(`${counts.failed} ${labels.failed}`);
  return `wiki ${parts.join(' · ')}`;
}

/** Short reason from the latest skipped/failed turn (optional suffix). */
export function latestWikiSkipHint(
  results: Record<string, PersistResult> | undefined,
): string | undefined {
  if (!results) return undefined;
  const entries = Object.values(results).filter(
    (r) => r.status === 'skipped' || r.status === 'failed',
  );
  const last = entries[entries.length - 1];
  const reason = last?.reason?.trim();
  if (!reason) return undefined;
  return reason.length > 24 ? `${reason.slice(0, 24)}…` : reason;
}
