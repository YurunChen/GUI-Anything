/**
 * StatusBadges - lightweight provenance badge components.
 */

import type { ReactNode } from 'react';
import { semantic } from '../theme';
import type { PersistResult } from '../../../data/protocol/observer-protocol';
import { getObserverMessages } from '../i18n/observer-messages';

interface PersistBadgeProps {
  status: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending' | undefined;
  result?: PersistResult;
  targetId?: string;
  turnCount?: number;
}

export function PersistBadge({ status, result, targetId, turnCount }: PersistBadgeProps): ReactNode {
  if (!status) return null;

  const { text, fg } = formatWikiPersistBadge(status, result?.reason, { targetId, turnCount });
  return <span fg={fg}>{text}</span>;
}

/** Per-card wiki write label, e.g. `wiki updated · C001 · 3 turns`. */
export function formatWikiPersistBadge(
  status: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending',
  reason?: string,
  extras?: { targetId?: string; turnCount?: number },
): { text: string; fg: string } {
  const m = getObserverMessages();
  const inner = formatPersist(status, reason, extras);
  return { text: `${m.wikiBadgeLabel} ${inner.text}`, fg: inner.fg };
}

function formatPersist(
  status: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending',
  reason?: string,
  extras?: { targetId?: string; turnCount?: number },
): { text: string; fg: string } {
  const m = getObserverMessages();
  const skipHint =
    status === 'skipped' && reason?.trim()
      ? ` (${reason.trim().slice(0, 28)})`
      : '';
  const suffixParts: string[] = [];
  if (extras?.targetId) suffixParts.push(extras.targetId);
  if (extras?.turnCount && extras.turnCount > 1) {
    suffixParts.push(`${extras.turnCount} turns`);
  }
  const suffix = suffixParts.length > 0 ? ` · ${suffixParts.join(' · ')}` : '';
  switch (status) {
    case 'saved':
      return { text: `${m.wikiWriteSaved}${suffix}`, fg: semantic.label.tertiary };
    case 'updated':
      return { text: `${m.wikiWriteUpdated}${suffix}`, fg: semantic.label.tertiary };
    case 'skipped':
      return { text: `${m.wikiWriteSkipped}${skipHint}`, fg: semantic.label.quaternary };
    case 'failed':
      return { text: m.wikiWriteFailed, fg: semantic.destructive };
    case 'pending':
      return { text: m.wikiWritePending, fg: semantic.label.tertiary };
  }
}
