/**
 * ExplorationCard - single timeline item for one exploration.
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { colors } from '../theme';
import type { Exploration, ExplorationNode, PersistResult } from '../../../data/protocol/observer-protocol';
import { PersistBadge } from './StatusBadges';
import { charDisplayWidth, lineDisplayWidth, wrapDisplayLines } from './summary-layout';

const TIMELINE_CONTINUE_PREFIX = '│ ';
const TIMELINE_END_PREFIX = '│ ';
const SUMMARY_LABEL = '  summary: ';
const SUMMARY_CONTINUATION_PREFIX = ' '.repeat(SUMMARY_LABEL.length);

interface ExplorationCardProps {
  exploration: Exploration;
  showRailConnector: boolean;
  isActive: boolean;
  spinnerFrame: string;
  /** Summary related */
  summary?: string;
  persistStatus?: 'saved' | 'skipped' | 'failed' | 'pending';
  persistResult?: PersistResult;
  isGenerating: boolean;
  /** Layout */
  availableWidth: number;
}

export const ExplorationCard = memo(function ExplorationCard(props: ExplorationCardProps): ReactNode {
  const {
    exploration,
    showRailConnector,
    isActive,
    spinnerFrame,
    summary,
    persistStatus,
    persistResult,
    isGenerating,
    availableWidth,
  } = props;

  // Stats
  const toolNodes = exploration.nodes.filter((node: ExplorationNode) => node.type === 'tool');
  const errorNodes = exploration.nodes.filter(
    (node: ExplorationNode) => node.status === 'error' || node.type === 'error'
  );

  // Tool usage stats
  const toolCounts = new Map<string, number>();
  for (const node of toolNodes) {
    const toolName = node.label.split(' ')[0] || 'unknown';
    toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
  }
  const toolSummary = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${truncate(name, 14)}×${count}`)
    .join('  ');

  // Status style
  const statusInfo = getStatusInfo(exploration.status, spinnerFrame);
  const questionMaxColumns = Math.max(24, Math.min(42, availableWidth - 42));
  const questionText = truncateByDisplayWidth(
    exploration.question.replace(/\s+/g, ' ').trim(),
    questionMaxColumns,
  ) || 'N/A';
  const showInlineSummary = true;
  const summarySnippet = buildInlineSummary(summary, isGenerating);
  const timelinePrefix = getTimelinePrefix(showRailConnector);
  const inlineSummaryLines = buildInlineSummaryLines(summarySnippet, availableWidth, timelinePrefix);
  const nodeMarker = isActive ? '◆ ' : '• ';
  const questionColor = isActive ? colors.accent.tertiary : colors.fg.primary;
  const railColor = isActive ? colors.accent.primary : colors.border.normal;

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        marginBottom: showRailConnector ? 1 : 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
        backgroundColor: colors.bg.primary,
      }}
    >
      {/* Stream row */}
      <box style={{ width: '100%', flexDirection: 'row' }}>
        <text fg={railColor}>{timelinePrefix}</text>
        <text>
          <span fg={isActive ? colors.accent.primary : colors.fg.dim}>{nodeMarker}</span>
          <span fg={statusInfo.color}>{statusInfo.badge}</span>
          <span fg={colors.fg.dim}>{'  '}</span>
          <span fg={questionColor}>{questionText}</span>
        </text>
      </box>

      <box style={{ width: '100%', flexDirection: 'row' }}>
        <text fg={railColor}>{timelinePrefix}</text>
        <text>
          <span>{'  '}</span>
          <span fg={colors.fg.dim}>{'tools:'}</span>
          <span fg={colors.fg.secondary}>{padNum(toolNodes.length, 1)}</span>
          <span fg={colors.fg.dim}>{'  '}</span>
          <span fg={colors.fg.dim}>{'errors:'}</span>
          <span fg={errorNodes.length > 0 ? colors.status.error : colors.fg.secondary}>{padNum(errorNodes.length, 1)}</span>
          <span fg={colors.fg.dim}>{'  '}</span>
          <span fg={colors.fg.dim}>{'wiki:'}</span>
          {persistStatus ? <PersistBadge status={persistStatus} result={persistResult} /> : <span>{'pending'}</span>}
          {toolSummary && <span fg={colors.fg.muted}>{`  ${toolSummary}`}</span>}
        </text>
      </box>

      {showInlineSummary && (
        <box style={{ width: '100%', flexDirection: 'column' }}>
          {inlineSummaryLines.map((line, index) => (
            <box key={`inline_summary_${index}`} style={{ width: '100%', flexDirection: 'row' }}>
              <text fg={railColor}>{timelinePrefix}</text>
              <text>
                <span fg={colors.fg.muted}>{index === 0 ? SUMMARY_LABEL : SUMMARY_CONTINUATION_PREFIX}</span>
                <span fg={isActive ? colors.fg.primary : colors.fg.secondary}>{line}</span>
              </text>
            </box>
          ))}
        </box>
      )}

    </box>
  );
});

// -------- Helpers --------

function getStatusInfo(
  status: Exploration['status'],
  spinnerFrame: string
): { badge: string; color: string } {
  switch (status) {
    case 'complete':
      return { badge: 'complete', color: colors.status.success };
    case 'interrupted':
      return { badge: 'interrupted', color: colors.status.warning };
    case 'running':
      return { badge: `${spinnerFrame} running`, color: colors.status.info };
    default:
      return { badge: status.toUpperCase(), color: colors.fg.muted };
  }
}

function padNum(value: number, width: number): string {
  return String(value).padStart(width, ' ');
}

export function shouldShowInlineSummary(status: Exploration['status'], expanded: boolean): boolean {
  return status === 'complete' && !expanded;
}

function getTimelinePrefix(showRailConnector: boolean): string {
  return showRailConnector ? TIMELINE_CONTINUE_PREFIX : TIMELINE_END_PREFIX;
}

function buildInlineSummary(summary: string | undefined, isGenerating: boolean): string {
  if (!summary || !summary.trim()) {
    return isGenerating ? 'generating summary' : 'no summary';
  }
  return summary.replace(/\s+/g, ' ').trim();
}

export function buildInlineSummaryLines(
  summaryText: string,
  availableWidth: number,
  timelinePrefix: string,
): string[] {
  const railColumns = lineDisplayWidth(timelinePrefix);
  const labelColumns = lineDisplayWidth(SUMMARY_LABEL);
  // Reserve small safety columns for container paddings/border.
  const contentColumns = Math.max(12, availableWidth - railColumns - labelColumns - 6);
  return wrapDisplayLines(summaryText, contentColumns);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

function truncateByDisplayWidth(str: string, maxColumns: number): string {
  const safeColumns = Math.max(4, maxColumns);
  if (lineDisplayWidth(str) <= safeColumns) return str;

  const ellipsis = '…';
  const ellipsisWidth = lineDisplayWidth(ellipsis);
  let output = '';
  let usedColumns = 0;
  for (const ch of str) {
    const width = charDisplayWidth(ch);
    if (usedColumns + width + ellipsisWidth > safeColumns) break;
    output += ch;
    usedColumns += width;
  }
  return output ? `${output}${ellipsis}` : ellipsis;
}
