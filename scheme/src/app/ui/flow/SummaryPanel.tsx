/**
 * SummaryPanel - renders exploration summary with lightweight provenance context.
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { semantic, useThemeVersion } from '../theme';
import { truncateFlowText } from '../../../utils/flow-text';
import { FlowTextBlock } from './FlowTextBlock';

interface SummaryPanelProps {
  summary: string | undefined;
  isGenerating: boolean;
  availableWidth: number;
  compact?: boolean;
}

export const SummaryPanel = memo(function SummaryPanel(props: SummaryPanelProps): ReactNode {
  useThemeVersion();

  const {
    summary,
    isGenerating,
    availableWidth,
    compact = false,
  } = props;

  const summaryText = summary?.trim() || (isGenerating ? 'Generating...' : 'No summary');
  const textColor = isGenerating || !summary ? semantic.label.tertiary : semantic.label.primary;

  if (compact) {
    return (
      <text fg={textColor}>
        <span>{'summary: '}</span>
        <span>{truncateFlowText(summaryText, Math.max(20, availableWidth - 16))}</span>
      </text>
    );
  }

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        marginTop: 0,
        paddingLeft: 0,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
        border: ['left'],
        borderColor: semantic.separator,
        backgroundColor: semantic.fill.grouped,
      }}
    >
      <text fg={semantic.tint}>{'summary'}</text>
      <FlowTextBlock text={summaryText} fg={textColor} />
    </box>
  );
});
