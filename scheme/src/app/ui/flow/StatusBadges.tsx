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

export interface WikiPersistBadgeView {
  /** Full plain-text label (compact rows, tests). */
  text: string;
  fg: string;
  targetId?: string;
  statusText?: string;
  turnHint?: string;
}

export function PersistBadge({ status, result, targetId, turnCount }: PersistBadgeProps): ReactNode {
  if (!status) return null;

  const badge = formatWikiPersistBadge(status, result?.reason, { targetId, turnCount });
  if (badge.targetId && badge.statusText) {
    const m = getObserverMessages();
    return (
      <>
        <span fg={semantic.label.quaternary}>{m.wikiBadgeLabel} </span>
        <span fg={semantic.label.tertiary}>{badge.targetId} </span>
        <span fg={badge.fg}>{badge.statusText}{badge.turnHint ?? ''}</span>
      </>
    );
  }
  return <span fg={badge.fg}>{badge.text}</span>;
}

/** Per-card wiki write label, e.g. `wiki C001 saved` or `wiki C001 saved (3 turns)`. */
export function formatWikiPersistBadge(
  status: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending',
  reason?: string,
  extras?: { targetId?: string; turnCount?: number },
): WikiPersistBadgeView {
  const m = getObserverMessages();
  const targetId = extras?.targetId?.trim() || undefined;
  const turnHint =
    extras?.turnCount && extras.turnCount > 1
      ? ` (${extras.turnCount} turns)`
      : '';
  const skipHint =
    status === 'skipped' && reason?.trim()
      ? ` (${reason.trim().slice(0, 28)})`
      : '';

  const { statusText, fg } = resolveWikiPersistStatus(status, skipHint);
  if (targetId) {
    const text = `${m.wikiBadgeLabel} ${targetId} ${statusText}${turnHint}`;
    return { text, fg, targetId, statusText, turnHint: turnHint || undefined };
  }

  const text = `${m.wikiBadgeLabel} ${statusText}${turnHint}`;
  return { text, fg };
}

function resolveWikiPersistStatus(
  status: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending',
  skipHint: string,
): { statusText: string; fg: string } {
  const m = getObserverMessages();
  switch (status) {
    case 'saved':
      return { statusText: m.wikiWriteSaved, fg: semantic.label.tertiary };
    case 'updated':
      return { statusText: m.wikiWriteUpdated, fg: semantic.label.tertiary };
    case 'skipped':
      return { statusText: `${m.wikiWriteSkipped}${skipHint}`, fg: semantic.label.quaternary };
    case 'failed':
      return { statusText: m.wikiWriteFailed, fg: semantic.destructive };
    case 'pending':
      return { statusText: m.wikiWritePending, fg: semantic.label.tertiary };
  }
}
