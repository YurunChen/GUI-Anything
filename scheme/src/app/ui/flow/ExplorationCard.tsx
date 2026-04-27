/**
 * ExplorationCard - 单个 exploration 的状态卡片
 * 属于 "Now" 区块的列表项
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { colors } from '../theme';
import type { Exploration, ExplorationNode } from '../../../data/protocol/observer-protocol';
import { SummaryPanel } from './SummaryPanel';

interface ExplorationCardProps {
  exploration: Exploration;
  index: number;
  isActive: boolean;
  /** Summary related */
  summary?: string;
  isGenerating: boolean;
  /** Layout */
  availableWidth: number;
}

export const ExplorationCard = memo(function ExplorationCard(props: ExplorationCardProps): ReactNode {
  const {
    exploration,
    index,
    isActive,
    summary,
    isGenerating,
    availableWidth,
  } = props;

  // 统计信息
  const toolNodes = exploration.nodes.filter((node: ExplorationNode) => node.type === 'tool');
  const errorNodes = exploration.nodes.filter(
    (node: ExplorationNode) => node.status === 'error' || node.type === 'error'
  );

  // 工具使用统计
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

  // 状态样式
  const statusInfo = getStatusInfo(exploration.status);

  return (
    <box
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
      {/* 标题行：Exploration 序号 + 状态 */}
      <box style={{ flexDirection: 'row' }}>
        <text>
          <span fg={isActive ? colors.accent.tertiary : colors.accent.primary}>
            {`● Exploration ${index + 1}`}
          </span>
          <span fg={colors.fg.dim}>{'  │  '}</span>
          <span fg={statusInfo.color}>{statusInfo.badge}</span>
        </text>
      </box>

      {/* 问题文本 */}
      <text>
        <span fg={colors.fg.secondary}>{'└─ '}</span>
        <span fg={colors.fg.secondary}>
          {truncate(exploration.question.replace(/\s+/g, ' ').trim(), 96) || 'N/A'}
        </span>
      </text>

      {/* 工具统计行 */}
      <box style={{ flexDirection: 'row', paddingLeft: 2 }}>
        <text>
          <span fg={colors.status.info}>{`Tools ${padNum(toolNodes.length, 3)}`}</span>
          <span fg={colors.fg.dim}>{' │ '}</span>
          <span fg={errorNodes.length > 0 ? colors.status.error : colors.fg.secondary}>
            {`Errors ${padNum(errorNodes.length, 3)}`}
          </span>
          <span fg={colors.fg.dim}>{' │ '}</span>
          <span fg={colors.fg.muted}>{toolSummary || 'none yet'}</span>
        </text>
      </box>

      {/* Summary panel (completed only) */}
      {exploration.status === 'complete' && (
        <SummaryPanel
          summary={summary}
          isGenerating={isGenerating}
          availableWidth={availableWidth}
        />
      )}
    </box>
  );
});

// -------- 辅助函数 --------

function getStatusInfo(status: Exploration['status']): { badge: string; color: string } {
  switch (status) {
    case 'complete':
      return { badge: 'COMPLETE', color: colors.status.success };
    case 'interrupted':
      return { badge: 'INTERRUPTED', color: colors.status.warning };
    case 'running':
      return { badge: 'RUNNING', color: colors.status.info };
    default:
      return { badge: status.toUpperCase(), color: colors.fg.muted };
  }
}

function padNum(value: number, width: number): string {
  return String(value).padStart(width, ' ');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}
