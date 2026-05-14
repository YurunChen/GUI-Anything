/**
 * SummaryPanel - renders exploration summary with lightweight provenance context.
 * Core component in the "Learned" section.
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { colors } from '../theme';
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

// -------- Helpers --------

/** Calculate textarea height (number of lines) */
function calculateTextareaHeight(value: string, availableWidth: number): number {
  const columns = Math.max(20, availableWidth - 8);
  return wrapDisplayLines(value, columns).length;
}
