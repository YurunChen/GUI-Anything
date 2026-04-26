/**
 * ABOUTME: Flow list + directions for live observer — static display, no animations.
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import type { Exploration } from '../../runtime/posthoc';
import type { PotentialDirection } from '../../core/flow-summaries';
import { formatSummaryForTui } from '../../utils/summary-text';
import { colors } from './theme';

export type LiveObserverFlowBodyProps = {
  explorations: Exploration[];
  summaries: Record<string, string>;
  wikiPersistStatus: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
  pendingSummaryCount: number;
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

function clampText(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1))}…`;
}

function charDisplayWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

function lineDisplayWidth(line: string): number {
  let width = 0;
  for (const ch of line) {
    width += charDisplayWidth(ch);
  }
  return width;
}

function summaryHeight(value: string): number {
  // Account for both explicit newlines and soft-wrap in terminal width.
  // Use display width (CJK full-width chars count as 2).
  const approxColsPerLine = 52;
  const lines = value.split(/\r?\n/);
  let visualLines = 0;
  for (const line of lines) {
    visualLines += Math.max(1, Math.ceil(lineDisplayWidth(line) / approxColsPerLine));
  }
  // Add one safety line to avoid clipping by border/padding variance.
  return Math.max(1, visualLines + 1);
}

export const LiveObserverFlowBody = memo(function LiveObserverFlowBody(
  props: LiveObserverFlowBodyProps
): ReactNode {
  const {
    explorations,
    summaries,
    wikiPersistStatus,
    pendingSummaryCount,
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
    // If summary is missing and exploration is complete, likely summarizing
    const summarizing = !summary && exploration.status === 'complete' && pendingSummaryCount > 0;
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
    const persistStatus = wikiPersistStatus[exploration.id];
    const isActive = index === latestRunningIdx;
    const toolCounts = new Map<string, number>();
    for (const node of toolNodes) {
      const toolName = node.label.split(' ')[0] || 'unknown';
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
    }
    const toolSummary = [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => `${clampText(name, 14)}×${count}`)
      .join('  ');

    const summaryBody =
      summary && summary.trim()
        ? formatSummaryForTui(summary)
        : (summarizing ? 'summarizing...' : 'pending');
    const summaryBodyFg = summarizing || !summary ? colors.fg.muted : colors.fg.secondary;
    const questionText = clampText(exploration.question.replace(/\s+/g, ' ').trim(), 96);

    return (
      <box
        key={exploration.id}
        style={{
          width: '100%',
          flexDirection: 'column',
          marginBottom: 1,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 1,
          paddingBottom: 0,
          backgroundColor: colors.bg.primary,
        }}
      >
        <text>
          <span fg={isActive ? colors.accent.tertiary : colors.accent.primary}>{`● Exploration ${index + 1}`}</span>
          <span fg={colors.fg.dim}>{'  │  '}</span>
          <span fg={statusColor}>{statusBadge}</span>
          {exploration.status === 'complete' && persistStatus === 'saved' && (
            <>
              <span fg={colors.fg.dim}>{'  │  '}</span>
              <span fg={colors.status.success}>Wiki SAVED</span>
            </>
          )}
          {exploration.status === 'complete' && persistStatus === 'skipped' && (
            <>
              <span fg={colors.fg.dim}>{'  │  '}</span>
              <span fg={colors.fg.muted}>Wiki SKIPPED</span>
            </>
          )}
          {exploration.status === 'complete' && persistStatus === 'failed' && (
            <>
              <span fg={colors.fg.dim}>{'  │  '}</span>
              <span fg={colors.status.error}>Wiki FAILED</span>
            </>
          )}
          {exploration.status === 'complete' && persistStatus === 'pending' && (
            <>
              <span fg={colors.fg.dim}>{'  │  '}</span>
              <span fg={colors.status.info}>Wiki PENDING</span>
            </>
          )}
        </text>
        <text>
          <span fg={colors.fg.secondary}>{'└─ '}</span>
          <span fg={colors.fg.secondary}>{questionText || 'N/A'}</span>
        </text>
        <box style={{ flexDirection: 'row', paddingLeft: 2 }}>
          <text>
            <span fg={colors.status.info}>{`Tools ${fixedNum(toolNodes.length)}`}</span>
            <span fg={colors.fg.dim}>{' │ '}</span>
            <span fg={errorNodes.length > 0 ? colors.status.error : colors.fg.secondary}>
              {`Errors ${fixedNum(errorNodes.length)}`}
            </span>
            <span fg={colors.fg.dim}>{' │ '}</span>
            <span fg={colors.fg.muted}>{toolSummary || 'none yet'}</span>
          </text>
        </box>

        {exploration.status === 'complete' && (
          <box
            style={{
              flexDirection: 'column',
              marginTop: 1,
              paddingLeft: 2,
              paddingRight: 1,
              paddingTop: 0,
              paddingBottom: 0,
              border: ['left'],
              borderColor: colors.status.success,
              borderStyle: 'single',
              backgroundColor: colors.bg.tertiary,
            }}
          >
            <text fg={colors.status.success}>{'✦ Summary'}</text>
            <textarea
              key={`summary_${exploration.id}_${summaryBody}`}
              initialValue={summaryBody}
              focused={false}
              style={{
                height: summaryHeight(summaryBody),
                wrapMode: 'char',
                backgroundColor: 'transparent',
                textColor: summaryBodyFg,
              }}
            />
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
