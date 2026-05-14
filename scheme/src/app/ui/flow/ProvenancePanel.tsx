/**
 * ProvenancePanel - user-readable data lineage display.
 *
 * Shows:
 * - summary origin (live/cache/wiki/fallback)
 * - wiki persistence status and reason
 * - timing info (when available)
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { colors } from '../theme';
import type { HumanReadableProvenance } from '../../../services/ai/provenance-service';

interface ProvenancePanelProps {
  provenance: HumanReadableProvenance;
  /** Compact mode (single line). */
  compact?: boolean;
}

export const ProvenancePanel = memo(function ProvenancePanel(
  props: ProvenancePanelProps
): ReactNode {
  const { provenance, compact = false } = props;
  const { summarySource, summaryDetail, wikiStatus, wikiDetail } = provenance;

  // Compact mode: single-line rendering.
  if (compact) {
    return (
      <text fg={colors.fg.muted}>
        <span>{'─ Source: '}</span>
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

  // Full mode: multi-line rendering.
  return (
    <box
      style={{
        flexDirection: 'column',
        marginTop: 1,
        paddingLeft: 2,
      }}
    >
      {/* Summary source row */}
      <text>
        <span fg={colors.fg.dim}>{'─ Source: '}</span>
        <span fg={getSourceColor(summarySource)}>{summarySource}</span>
        {summaryDetail && (
          <span fg={colors.fg.muted}>{` (${summaryDetail})`}</span>
        )}
      </text>

      {/* Wiki status row (if available). */}
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

/** Select color for source label. */
function getSourceColor(source: string): string {
  if (source.toLowerCase().includes('live') || source.includes('实时生成')) return colors.accent.primary;
  if (source.toLowerCase().includes('cache') || source.includes('缓存')) return colors.status.info;
  if (source.toLowerCase().includes('wiki') || source.includes('知识库')) return colors.status.success;
  if (source.toLowerCase().includes('fallback') || source.includes('降级')) return colors.status.warning;
  return colors.fg.secondary;
}

/** Select color for wiki status label. */
function getWikiColor(status: string): string {
  if (status.toLowerCase().includes('saved') || status.includes('已保存')) return colors.status.success;
  if (status.toLowerCase().includes('skipped') || status.includes('已跳过')) return colors.fg.muted;
  if (status.toLowerCase().includes('fail') || status.includes('失败')) return colors.status.error;
  if (status.toLowerCase().includes('pending') || status.includes('中')) return colors.status.info;
  return colors.fg.secondary;
}
