/**
 * ExplorationCard - single timeline item for one exploration.
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { colors, useThemeVersion } from '../theme';
import type { Exploration, ExplorationNode, PersistResult, WikiMatch } from '../../../data/protocol/observer-protocol';
import { PersistBadge } from './StatusBadges';
import { WikiMatchCard } from './WikiMatchCard';
import { lineDisplayWidth, wrapDisplayLines } from './summary-layout';

const TIMELINE_CONTINUE_PREFIX = '│ ';
const TIMELINE_END_PREFIX = '│ ';
const SUMMARY_LABEL = '  summary: ';
const SUMMARY_CONTINUATION_PREFIX = ' '.repeat(SUMMARY_LABEL.length);

interface ExplorationCardProps {
  exploration: Exploration;
  showRailConnector: boolean;
  isActive: boolean;
  spinnerFrame: string;
  summary?: string;
  persistStatus?: 'saved' | 'skipped' | 'failed' | 'pending';
  persistResult?: PersistResult;
  isGenerating: boolean;
  availableWidth: number;
  wikiMatch?: WikiMatch;
}

export const ExplorationCard = memo(function ExplorationCard(props: ExplorationCardProps): ReactNode {
  useThemeVersion();

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
    wikiMatch,
  } = props;

  const toolNodes = exploration.nodes.filter((node: ExplorationNode) => node.type === 'tool');
  const errorNodes = exploration.nodes.filter(
    (node: ExplorationNode) => node.status === 'error' || node.type === 'error'
  );

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

  const statusInfo = getStatusInfo(exploration.status, spinnerFrame);
  const timelinePrefix = getTimelinePrefix(showRailConnector);
  const questionPrefix = `${nodeMarkerFor(isActive)}${statusInfo.badge}  `;
  const questionLines = buildQuestionLines(
    exploration.question,
    availableWidth,
    timelinePrefix,
    questionPrefix,
  );
  const firstQuestionLine = questionLines[0] ?? 'N/A';
  const questionContinuationPrefix = ' '.repeat(lineDisplayWidth(questionPrefix));
  const showInlineSummary = true;
  const summarySnippet = buildInlineSummary(summary, isGenerating);
  const inlineSummaryLines = buildInlineSummaryLines(summarySnippet, availableWidth, timelinePrefix);
  const nodeMarker = nodeMarkerFor(isActive);
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
      <box style={{ width: '100%', flexDirection: 'row' }}>
        <text fg={railColor}>{timelinePrefix}</text>
        <text>
          <span fg={isActive ? colors.accent.primary : colors.fg.dim}>{nodeMarker}</span>
          <span fg={statusInfo.color}>{statusInfo.badge}</span>
          <span fg={colors.fg.dim}>{'  '}</span>
          <span fg={questionColor}>{firstQuestionLine}</span>
        </text>
      </box>
      {questionLines.slice(1).map((line, index) => (
        <box key={`question_cont_${index}`} style={{ width: '100%', flexDirection: 'row' }}>
          <text fg={railColor}>{timelinePrefix}</text>
          <text>
            <span fg={colors.fg.dim}>{questionContinuationPrefix}</span>
            <span fg={questionColor}>{line}</span>
          </text>
        </box>
      ))}

      {wikiMatch && (
        <box style={{ paddingLeft: 2, paddingTop: 1 }}>
          <WikiMatchCard match={wikiMatch} availableWidth={availableWidth} />
        </box>
      )}

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
    default: {
      const _exhaustive: never = status;
      return { badge: String(_exhaustive), color: colors.fg.muted };
    }
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

function nodeMarkerFor(isActive: boolean): string {
  return isActive ? '◆ ' : '• ';
}

function buildQuestionLines(
  question: string,
  availableWidth: number,
  timelinePrefix: string,
  questionPrefix: string,
): string[] {
  const normalized = question.replace(/\s+/g, ' ').trim() || 'N/A';
  const railColumns = lineDisplayWidth(timelinePrefix);
  const prefixColumns = lineDisplayWidth(questionPrefix);
  const contentColumns = Math.max(12, availableWidth - railColumns - prefixColumns - 6);
  return wrapDisplayLines(normalized, contentColumns);
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
  const contentColumns = Math.max(12, availableWidth - railColumns - labelColumns - 6);
  return wrapDisplayLines(summaryText, contentColumns);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}
