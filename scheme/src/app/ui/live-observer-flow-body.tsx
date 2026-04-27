/**
 * LiveObserverFlowBody - 三段式心流面板
 * 
 * Layout:
 *   Now      - exploration 列表（状态、工具统计）
 *   Learned  - summary + provenance（每个 exploration 内嵌）
 *   Next     - directions + wiki match（底部或侧边）
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import type { Exploration, CacheLoadStatus } from '../../data/protocol/observer-protocol';
import type { PotentialDirection } from '../../services/ai/flow-summaries';
import { colors } from './theme';
import { ExplorationCard } from './flow/ExplorationCard';
import { CacheBadge } from './flow/StatusBadges';

export type LiveObserverFlowBodyProps = {
  explorations: Exploration[];
  summaries: Record<string, string>;
  pendingSummaryCount: number;
  directionsStatus: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
  directionsMessage: string;
  potentialDirections: PotentialDirection[];
  /** Available width for content calculation */
  availableWidth?: number;
  /** Cache status for session */
  cacheStatus?: CacheLoadStatus | null;
  /** Cache reason/description */
  cacheReason?: string;
};

export const LiveObserverFlowBody = memo(function LiveObserverFlowBody(
  props: LiveObserverFlowBodyProps
): ReactNode {
  const {
    explorations,
    summaries,
    pendingSummaryCount,
    directionsStatus,
    directionsMessage,
    potentialDirections,
    availableWidth = 80,
    cacheStatus,
    cacheReason,
  } = props;

  if (explorations.length === 0) {
    return <text fg={colors.fg.muted}>Waiting for explorations...</text>;
  }

  // 找到最新的 running exploration（用于高亮）
  let latestRunningIdx = -1;
  for (let i = explorations.length - 1; i >= 0; i--) {
    if (explorations[i].status === 'running') {
      latestRunningIdx = i;
      break;
    }
  }

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {/* ========== NOW 区块：当前 exploration 列表 ========== */}
      <box style={{ width: '100%', flexDirection: 'column' }}>
        {cacheStatus && (
          <text fg={colors.fg.dim}>
            <span>{'['}</span>
            <CacheBadge status={cacheStatus} reason={cacheReason} />
            <span>{']'}</span>
          </text>
        )}
        
        {explorations.map((exploration, index) => {
          const isGenerating = !summaries[exploration.id] 
            && exploration.status === 'complete' 
            && pendingSummaryCount > 0;

          return (
            <ExplorationCard
              key={exploration.id}
              exploration={exploration}
              index={index}
              isActive={index === latestRunningIdx}
              summary={summaries[exploration.id]}
              isGenerating={isGenerating}
              availableWidth={availableWidth}
            />
          );
        })}
      </box>

      {/* ========== NEXT 区块：方向建议（轻提示，不打断） ========== */}
      <NextPanel
        status={directionsStatus}
        message={directionsMessage}
        directions={potentialDirections}
      />
    </box>
  );
});

// -------- Next 区块组件 --------

interface NextPanelProps {
  status: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
  message: string;
  directions: PotentialDirection[];
}

function NextPanel({ status, message, directions }: NextPanelProps): ReactNode {
  if (status === 'idle') return null;

  // 轻提示样式：不占用过多空间，默认折叠感
  const panelStyle = {
    width: '100%' as const,
    flexDirection: 'column' as const,
    marginTop: 1,
    paddingLeft: 1,
    paddingRight: 1,
    border: ['top'] as ['top'],
    borderColor: colors.border.normal,
    borderStyle: 'single' as const,
  };

  if (status === 'generating') {
    return (
      <box style={panelStyle}>
        <text fg={colors.status.info}>Next: generating suggestions...</text>
      </box>
    );
  }

  if (status === 'insufficient') {
    return (
      <box style={panelStyle}>
        <text fg={colors.status.warning}>Next: 证据不足</text>
        <text fg={colors.fg.secondary}>{message || '继续探索以获取建议'}</text>
      </box>
    );
  }

  if (status === 'error') {
    return (
      <box style={panelStyle}>
        <text fg={colors.status.error}>Next: 建议生成失败</text>
      </box>
    );
  }

  // status === 'ready'
  return (
    <box style={panelStyle}>
      <text fg={colors.status.success}>Next: Potential Directions</text>
      {directions.map((item, idx) => (
        <box key={`dir_${idx}`} style={{ width: '100%', flexDirection: 'column', marginTop: idx > 0 ? 1 : 0 }}>
          <text fg={colors.accent.primary}>{`${idx + 1}. ${item.direction}`}</text>
          <text fg={colors.fg.secondary}>{`   Why: ${truncate(item.why, 40)}`}</text>
          <text fg={colors.fg.muted}>{`   → ${truncate(item.nextAction, 30)} (${item.confidence})`}</text>
        </box>
      ))}
    </box>
  );
}

// -------- 辅助函数 --------

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

// 保留导出，供测试使用
export { lineDisplayWidth, wrapDisplayLines } from './flow/summary-layout';
