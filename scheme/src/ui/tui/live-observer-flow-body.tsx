/**
 * ABOUTME: Flow list + directions for live observer — static display, no animations.
 */

import type { MutableRefObject, ReactNode } from 'react';
import { memo } from 'react';
import type { Exploration } from '../../runtime/posthoc';
import type { PotentialDirection } from '../../core/flow-summaries';
import { formatSummaryForTui } from '../../utils/summary-text';
import { colors } from './theme';

export type LiveObserverFlowBodyProps = {
  explorations: Exploration[];
  summaries: Record<string, string>;
  pendingSummaryRef: MutableRefObject<Set<string>>;
  directionsStatus: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
  directionsMessage: string;
  potentialDirections: PotentialDirection[];
};

function fixedNum(value: number, width = 3): string {
  return String(value).padStart(width, ' ');
}

function padLabel(label: string, width = 5): string {
  return label.padEnd(width, ' ');
}

export const LiveObserverFlowBody = memo(function LiveObserverFlowBody(
  props: LiveObserverFlowBodyProps
): ReactNode {
  const {
    explorations,
    summaries,
    pendingSummaryRef,
    directionsStatus,
    directionsMessage,
    potentialDirections,
  } = props;

  const renderPotentialDirections = (): ReactNode => {
    if (directionsStatus === 'idle') return null;
    if (directionsStatus === 'generating') {
      return <text fg={colors.status.info}>Potential Directions: generating...</text>;
    }
    if (directionsStatus === 'insufficient') {
      return (
        <box style={{ width: '100%', flexDirection: 'column', marginTop: 1, paddingLeft: 1 }}>
          <text fg={colors.status.warning}>Potential Directions</text>
          <text fg={colors.fg.secondary}>{directionsMessage || '当前证据不足，请继续探索。'}</text>
        </box>
      );
    }
    if (directionsStatus === 'error') {
      return <text fg={colors.status.error}>{directionsMessage || 'Potential Directions: failed'}</text>;
    }
    return (
      <box style={{ width: '100%', flexDirection: 'column', marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
        <text fg={colors.status.success}>Potential Directions</text>
        {potentialDirections.map((item, idx) => {
          const prefix = idx === 0 ? '' : ' ';
          return (
            <box key={`dir_${idx}`} style={{ width: '100%', flexDirection: 'column' }}>
              <text fg={colors.accent.primary}>{`${prefix}${idx + 1}. ${item.direction}`}</text>
              <text fg={colors.fg.secondary}>{`   ${padLabel('Why:')} ${item.why}`}</text>
              <text fg={colors.fg.muted}>{`   ${padLabel('Next:')} ${item.nextAction} (${item.confidence})`}</text>
            </box>
          );
        })}
      </box>
    );
  };

  if (explorations.length === 0) {
    return <text fg={colors.fg.muted}>Waiting for explorations...</text>;
  }

  let latestRunningIdx = -1;
  for (let i = explorations.length - 1; i >= 0; i--) {
    if (explorations[i].status === 'running') {
      latestRunningIdx = i;
      break;
    }
  }

  const rows = explorations.map((exploration, index) => {
    const summary = summaries[exploration.id];
    const summarizing = pendingSummaryRef.current.has(exploration.id);
    const toolNodes = exploration.nodes.filter((node) => node.type === 'tool');
    const errorNodes = exploration.nodes.filter((node) => node.status === 'error' || node.type === 'error');
    const statusColor =
      exploration.status === 'complete'
        ? colors.status.success
        : exploration.status === 'interrupted'
          ? colors.status.warning
          : colors.status.info;
    const statusBadge =
      exploration.status === 'complete'
        ? 'COMPLETE'
        : exploration.status === 'interrupted'
          ? 'INTERRUPTED'
          : 'RUNNING';
    const isActive = index === latestRunningIdx;
    const toolCounts = new Map<string, number>();
    for (const node of toolNodes) {
      const toolName = node.label.split(' ')[0] || 'unknown';
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
    }
    const toolSummary = [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => `${name}×${count}`)
      .join('  ');

    const summaryBody =
      summary && summary.trim()
        ? formatSummaryForTui(summary)
        : (summarizing ? 'summarizing...' : 'pending');
    const summaryBodyFg = summarizing || !summary ? colors.fg.muted : colors.fg.secondary;
    const questionText = exploration.question.replace(/\s+/g, ' ').trim();

    return (
      <box
        key={exploration.id}
        style={{
          width: '100%',
          flexDirection: 'column',
          marginBottom: 1,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 0,
          paddingBottom: 0,
          backgroundColor: colors.bg.primary,
        }}
      >
        <text>
          <span fg={isActive ? colors.accent.tertiary : colors.accent.primary}>{`● Exploration ${index + 1}`}</span>
          <span fg={colors.fg.dim}>{'  │  '}</span>
          <span fg={statusColor}>{statusBadge}</span>
        </text>
        <text>
          <span fg={colors.fg.secondary}>{'└─ '}</span>
          <span fg={colors.fg.secondary}>{questionText || 'N/A'}</span>
        </text>
        <text>
          <span fg={colors.status.info}>{`Tools ${fixedNum(toolNodes.length)}`}</span>
          <span fg={colors.fg.dim}>{' │ '}</span>
          <span fg={errorNodes.length > 0 ? colors.status.error : colors.fg.secondary}>
            {`Errors ${fixedNum(errorNodes.length)}`}
          </span>
          <span fg={colors.fg.dim}>{' │ '}</span>
          <span fg={colors.fg.muted}>{toolSummary || 'none yet'}</span>
        </text>

        {exploration.status === 'complete' && (
          <box
            style={{
              flexDirection: 'column',
              marginTop: 1,
              paddingLeft: 2,
              paddingRight: 1,
              border: ['left'],
              borderColor: colors.status.success,
              borderStyle: 'single',
              backgroundColor: colors.bg.tertiary,
            }}
          >
            <text fg={colors.status.success}>{'✦ Summary'}</text>
            <text fg={summaryBodyFg}>{summaryBody}</text>
          </box>
        )}
      </box>
    );
  });

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {rows}
      {renderPotentialDirections()}
    </box>
  );
});
