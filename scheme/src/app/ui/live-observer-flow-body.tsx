/**
 * LiveObserverFlowBody - three-section flow panel.
 *
 * Layout:
 *   Now      - exploration list (status, tool stats)
 *   Learned  - summary + provenance (embedded per exploration)
 *   Next     - suggestions + wiki match (bottom/side)
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import type { Exploration, CacheLoadStatus, PersistResult, SummaryItem } from '../../data/protocol/observer-protocol';
import type { PotentialDirection } from '../../services/ai/flow-summaries';
import { colors } from './theme';
import { ExplorationCard } from './flow/ExplorationCard';
import { CacheBadge } from './flow/StatusBadges';

export type LiveObserverFlowBodyProps = {
  explorations: Exploration[];
  summaries: Record<string, string>;
  wikiPersistStatus?: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
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
  summarySources?: Record<string, SummaryItem['source']>;
  summaryReasons?: Record<string, string>;
  persistResults?: Record<string, PersistResult>;
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

  // Find the latest running exploration (for highlight).
  let latestRunningIdx = -1;
  for (let i = explorations.length - 1; i >= 0; i--) {
    if (explorations[i].status === 'running') {
      latestRunningIdx = i;
      break;
    }
  }

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {/* NOW: exploration list */}
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

      {/* NEXT: lightweight suggestions */}
      <NextPanel
        status={directionsStatus}
        message={directionsMessage}
        directions={potentialDirections}
      />
    </box>
  );
});

// -------- Next section component --------

interface NextPanelProps {
  status: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
  message: string;
  directions: PotentialDirection[];
}

function NextPanel({ status, message, directions }: NextPanelProps): ReactNode {
  if (status === 'idle') return null;

  // Lightweight style: small footprint, low interruption.
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
        <text fg={colors.status.warning}>Next: insufficient evidence</text>
        <text fg={colors.fg.secondary}>{message || 'Continue exploring to unlock suggestions.'}</text>
      </box>
    );
  }

  if (status === 'error') {
    return (
      <box style={panelStyle}>
        <text fg={colors.status.error}>Next: failed to generate suggestions</text>
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

// -------- Helpers --------

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

// Keep exports for tests.
export { lineDisplayWidth, wrapDisplayLines } from './flow/summary-layout';
