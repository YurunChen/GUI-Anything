/**
 * FlowMetaRow — footnote: status · tools · wiki write · extras.
 */

import type { ReactNode } from 'react';
import type { PersistResult } from '../../../../data/protocol/observer-protocol';
import { semantic } from '../../theme';
import { PersistBadge } from '../StatusBadges';

export type FlowStatusTone = 'complete' | 'running' | 'interrupted';

interface FlowMetaRowProps {
  statusBadge: string;
  statusTone: FlowStatusTone;
  toolCount: number;
  errorCount: number;
  toolSummary?: string;
  wikiPersistStatus?: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending';
  wikiPersistResult?: PersistResult;
  wikiTargetId?: string;
  wikiTurnCount?: number;
}

function statusColor(tone: FlowStatusTone): string {
  switch (tone) {
    case 'running':
      return semantic.activity;
    case 'interrupted':
      return semantic.warning;
    default:
      return semantic.label.tertiary;
  }
}

export function FlowMetaRow({
  statusBadge,
  statusTone,
  toolCount,
  errorCount,
  toolSummary,
  wikiPersistStatus,
  wikiPersistResult,
  wikiTargetId,
  wikiTurnCount,
}: FlowMetaRowProps): ReactNode {
  return (
    <text fg={semantic.label.quaternary}>
      <span fg={statusColor(statusTone)}>{statusBadge}</span>
      <span>{' · '}</span>
      <span>{`${toolCount} tools`}</span>
      {errorCount > 0 && (
        <>
          <span>{' · '}</span>
          <span fg={semantic.destructive}>{`${errorCount} err`}</span>
        </>
      )}
      {wikiPersistStatus ? (
        <>
          <span>{' · '}</span>
          <PersistBadge
            status={wikiPersistStatus}
            result={wikiPersistResult}
            targetId={wikiTargetId}
            turnCount={wikiTurnCount}
          />
        </>
      ) : null}
      {toolSummary && (
        <>
          <span>{' · '}</span>
          <span fg={semantic.label.tertiary}>{toolSummary}</span>
        </>
      )}
    </text>
  );
}
