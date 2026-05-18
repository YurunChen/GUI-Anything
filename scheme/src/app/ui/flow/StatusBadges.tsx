/**
 * StatusBadges - lightweight provenance badge components.
 * Displays summary source, wiki persistence status, and cache status.
 */

import type { ReactNode } from 'react';
import { colors } from '../theme';
import type { SummaryItem, PersistResult, CacheLoadStatus } from '../../../data/protocol/observer-protocol';

interface SourceBadgeProps {
  source: SummaryItem['source'];
  reason?: string;
}

/** Summary source badge: CACHE / WIKI / AI / FALLBACK
 * Note: returns a <span>, must be rendered inside a parent <text>.
 */
export function SourceBadge({ source, reason }: SourceBadgeProps): ReactNode {
  const { text, fg } = formatSource(source, reason);
  // Caller must wrap this in <text>.
  return <span fg={fg}>{text}</span>;
}

interface PersistBadgeProps {
  status: 'saved' | 'skipped' | 'failed' | 'pending' | undefined;
  result?: PersistResult;
}

/** Wiki persistence status badge. */
export function PersistBadge({ status, result }: PersistBadgeProps): ReactNode {
  if (!status) return null;

  const { text, fg } = formatPersist(status, result?.reason);
  return <span fg={fg}>{text}</span>;
}

interface CacheBadgeProps {
  status: CacheLoadStatus | null | undefined;
  reason?: string;
}

/** Cache status badge (typically shown in header/debug view). */
export function CacheBadge({ status, reason }: CacheBadgeProps): ReactNode {
  if (!status) return null;

  const { text, fg } = formatCache(status, reason);
  return <span fg={fg}>{text}</span>;
}

// -------- Formatting helpers --------

function formatSource(source: SummaryItem['source'], reason?: string): { text: string; fg: string } {
  switch (source) {
    case 'cache': {
      // Parse original source from reason, e.g. "from_ai" -> "CACHE[ai]".
      const origin = reason?.startsWith('from_') ? reason.slice(5) : '';
      const text = origin ? `cache:${origin}` : 'cache';
      return { text, fg: colors.status.info };
    }
    case 'wiki':
      return { text: 'wiki', fg: colors.status.success };
    case 'ai':
      return { text: 'generated', fg: colors.accent.primary };
    case 'fallback': {
      // Show compact failure hint.
      const hint = reason ? `[${truncate(reason, 10)}]` : '';
      return { text: `fallback${hint}`, fg: colors.status.warning };
    }
  }
}

function formatPersist(
  status: 'saved' | 'skipped' | 'failed' | 'pending',
  reason?: string
): { text: string; fg: string } {
  switch (status) {
    case 'saved':
      return { text: 'saved', fg: colors.status.success };
    case 'skipped': {
      // Map internal reason to a short UI label.
      const shortReason = formatSkipReason(reason);
      return { text: `skipped[${shortReason}]`, fg: colors.fg.muted };
    }
    case 'failed':
      return { text: 'failed', fg: colors.status.error };
    case 'pending':
      return { text: 'pending', fg: colors.status.info };
  }
}

function formatCache(
  status: CacheLoadStatus,
  reason?: string
): { text: string; fg: string } {
  switch (status) {
    case 'hit':
      return { text: 'cache:hit', fg: colors.status.success };
    case 'miss':
      return { text: 'cache:miss', fg: colors.fg.muted };
    case 'expired':
      return { text: 'cache:expired', fg: colors.status.warning };
    case 'corrupted':
      return { text: 'cache:bad', fg: colors.status.error };
  }
}

function formatSkipReason(reason?: string): string {
  if (!reason) return '?';
  
  const reasonMap: Record<string, string> = {
    'model_opt_out': 'opt-out',
    'low_value': 'low-value',
    'duplicate': 'dup',
    'missing_summary': 'no-sum',
    'already_persisted': 'exists',
  };
  
  // Check known reason aliases.
  for (const [key, value] of Object.entries(reasonMap)) {
    if (reason.includes(key)) return value;
  }
  
  // Otherwise truncate.
  return truncate(reason, 8);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}
