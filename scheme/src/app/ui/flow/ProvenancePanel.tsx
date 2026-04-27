/**
 * ProvenancePanel - 用户可理解的数据血缘展示
 * 
 * 展示：
 * - summary 从哪来（实时生成/缓存/知识库/降级）
 * - wiki 保存状态及原因
 * - 生成耗时（如果有）
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { colors } from '../theme';
import type { HumanReadableProvenance } from '../../../services/ai/provenance-service';

interface ProvenancePanelProps {
  provenance: HumanReadableProvenance;
  /** 是否紧凑模式（只显示一行） */
  compact?: boolean;
}

export const ProvenancePanel = memo(function ProvenancePanel(
  props: ProvenancePanelProps
): ReactNode {
  const { provenance, compact = false } = props;
  const { summarySource, summaryDetail, wikiStatus, wikiDetail } = provenance;

  // 紧凑模式：一行展示
  if (compact) {
    return (
      <text fg={colors.fg.muted}>
        <span>{'─ 来源: '}</span>
        <span fg={getSourceColor(summarySource)}>{summarySource}</span>
        {summaryDetail && <span>{` (${summaryDetail})`}</span>}
        {wikiStatus && (
          <>
            <span>{'  │  Wiki: '}</span>
            <span fg={getWikiColor(wikiStatus)}>{wikiStatus}</span>
          </>
        )}
      </text>
    );
  }

  // 完整模式：多行展示
  return (
    <box
      style={{
        flexDirection: 'column',
        marginTop: 1,
        paddingLeft: 2,
      }}
    >
      {/* Summary 来源行 */}
      <text>
        <span fg={colors.fg.dim}>{'─ 来源: '}</span>
        <span fg={getSourceColor(summarySource)}>{summarySource}</span>
        {summaryDetail && (
          <span fg={colors.fg.muted}>{` (${summaryDetail})`}</span>
        )}
      </text>

      {/* Wiki 状态行（如果有） */}
      {wikiStatus && (
        <text>
          <span fg={colors.fg.dim}>{'─ Wiki: '}</span>
          <span fg={getWikiColor(wikiStatus)}>{wikiStatus}</span>
          {wikiDetail && (
            <span fg={colors.fg.muted}>{` (${wikiDetail})`}</span>
          )}
        </text>
      )}
    </box>
  );
});

/** 根据来源获取颜色 */
function getSourceColor(source: string): string {
  if (source.includes('实时生成')) return colors.accent.primary;
  if (source.includes('缓存')) return colors.status.info;
  if (source.includes('知识库')) return colors.status.success;
  if (source.includes('降级')) return colors.status.warning;
  return colors.fg.secondary;
}

/** 根据 Wiki 状态获取颜色 */
function getWikiColor(status: string): string {
  if (status.includes('已保存')) return colors.status.success;
  if (status.includes('已跳过')) return colors.fg.muted;
  if (status.includes('失败')) return colors.status.error;
  if (status.includes('中')) return colors.status.info;
  return colors.fg.secondary;
}
