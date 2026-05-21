/**
 * SummaryPanel - 显示 exploration summary + provenance 轻提示
 * 属于 "Learned" 区块的核心组件
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { colors, useThemeVersion } from '../theme';
import { formatSummaryForTui } from '../../../utils/summary-text';
import { wrapDisplayLines } from './summary-layout';

interface SummaryPanelProps {
  /** Summary text */
  summary: string | undefined;
  /** Whether summary is being generated */
  isGenerating: boolean;
  /** Available width for textarea height calculation */
  availableWidth: number;
}

export const SummaryPanel = memo(function SummaryPanel(props: SummaryPanelProps): ReactNode {
  // memo 子树需显式订阅主题版本号, 否则 colors mutate 后这里不会重渲染
  useThemeVersion();

  const {
    summary,
    isGenerating,
    availableWidth,
  } = props;

  const summaryText = summary?.trim() || (isGenerating ? 'Generating...' : 'No summary');
  const displayText = formatSummaryForTui(summaryText);
  const textColor = isGenerating || !summary ? colors.fg.muted : colors.fg.secondary;

  return (
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

      {/* Summary text */}
      <textarea
        key={`summary_${displayText.slice(0, 50)}`}
        initialValue={displayText}
        focused={false}
        style={{
          height: calculateTextareaHeight(displayText, availableWidth),
          wrapMode: 'char',
          backgroundColor: 'transparent',
          textColor: textColor,
        }}
      />
    </box>
  );
});

// -------- 辅助函数 --------

/** Calculate textarea height (number of lines) */
function calculateTextareaHeight(value: string, availableWidth: number): number {
  const columns = Math.max(20, availableWidth - 8);
  return wrapDisplayLines(value, columns).length;
}
