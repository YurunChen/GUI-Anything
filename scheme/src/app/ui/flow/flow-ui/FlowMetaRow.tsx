/**
 * FlowMetaRow — footnote: status · tools · wiki write · extras.
 */

import type { ReactNode } from 'react';
import type { PersistResult } from '../../../../data/protocol/observer-protocol';
import { useTuiTheme } from '../../theme';
import type { TimelineModeTheme } from '../../themes/resolved-theme';
import { PersistBadge } from '../StatusBadges';

export type FlowStatusTone = 'complete' | 'running' | 'interrupted';

interface FlowMetaRowProps {
  statusBadge: string;
  statusTone: FlowStatusTone;
  toolCount: number;
  toolsUnit?: string;
  errorCount: number;
  toolSummary?: string;
  wikiPersistStatus?: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending';
  wikiPersistResult?: PersistResult;
  wikiTargetId?: string;
  wikiTurnCount?: number;
}

function statusColor(tone: FlowStatusTone, meta: TimelineModeTheme['meta']): string {
  switch (tone) {
    case 'running':
      return meta.runningFg;
    case 'interrupted':
      return meta.interruptedFg;
    default:
      return meta.completeFg;
  }
}

export function FlowMetaRow({
  statusBadge,
  statusTone,
  toolCount,
  toolsUnit = 'tools',
  errorCount,
  toolSummary,
  wikiPersistStatus,
  wikiPersistResult,
  wikiTargetId,
  wikiTurnCount,
}: FlowMetaRowProps): ReactNode {
  const meta = useTuiTheme().modes.timeline.meta;
  return (
    <text fg={meta.baseFg}>
      <span fg={statusColor(statusTone, meta)}>{statusBadge}</span>
      <span>{' · '}</span>
      <span>{`${toolCount} ${toolsUnit}`}</span>
      {errorCount > 0 && (
        <>
          <span>{' · '}</span>
          <span fg={meta.errorFg}>{`${errorCount} err`}</span>
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
          <span fg={meta.toolSummaryFg}>{toolSummary}</span>
        </>
      )}
    </text>
  );
}
