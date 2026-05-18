/**
 * LiveObserverFlowBody - chronological single-rail flow panel.
 *
 * Layout:
 *   Timeline - exploration list in strict time order
 *   Next     - lightweight suggestions section
 */

import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import type {
  Exploration,
  CacheLoadStatus,
  PersistResult,
  FlowchartHint,
  FlowGraphSnapshot,
} from '../../data/protocol/observer-protocol';
import type { PotentialDirection } from '../../services/ai/flow-summaries';
import { colors, pulseFrames } from './theme';
import { CacheBadge } from './flow/StatusBadges';
import { ExplorationCard } from './flow/ExplorationCard';
import { FlowGraphView } from './flow/graph/FlowGraphView';
import { createCachedBuilder } from './flow/graph/snapshot-cache';

/** Ref-stable cached snapshot builder — only rebuilds when ID-level state actually changes. */
const snapshotCache = createCachedBuilder();

export type LiveObserverFlowBodyProps = {
  sessionId?: string;
  explorations: Exploration[];
  summaries: Record<string, string>;
  flowchartHints?: Record<string, FlowchartHint>;
  graphSnapshot?: FlowGraphSnapshot;
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
  /** Strict replay mode hint when regeneration is intentionally disabled. */
  replayOnlyHint?: string;
  persistResults?: Record<string, PersistResult>;
  mode?: 'exploration' | 'flowchart';
};

export interface TimelineEntry {
  exploration: Exploration;
  originalIndex: number;
}

export function sortTimelineEntries(explorations: Exploration[]): TimelineEntry[] {
  return explorations
    .map((exploration, originalIndex) => ({ exploration, originalIndex }))
    .sort((a, b) => {
      const startDiff = a.exploration.startedAt - b.exploration.startedAt;
      if (startDiff !== 0) return startDiff;
      const endA = a.exploration.endedAt ?? Number.MAX_SAFE_INTEGER;
      const endB = b.exploration.endedAt ?? Number.MAX_SAFE_INTEGER;
      const endDiff = endA - endB;
      if (endDiff !== 0) return endDiff;
      return a.originalIndex - b.originalIndex;
    });
}

export const LiveObserverFlowBody = memo(function LiveObserverFlowBody(
  props: LiveObserverFlowBodyProps
): ReactNode {
  const {
    explorations,
    sessionId = 'current',
    summaries,
    flowchartHints,
    graphSnapshot: externalGraphSnapshot,
    directionsStatus,
    directionsMessage,
    potentialDirections,
    availableWidth = 80,
    cacheStatus,
    cacheReason,
    replayOnlyHint,
    persistResults,
    wikiPersistStatus,
    pendingSummaryCount,
    mode = 'exploration',
  } = props;
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
  const hasRunning = explorations.some((item) => item.status === 'running');
  const showCacheBadge = Boolean(cacheStatus && cacheStatus !== 'miss');
  const graphSnapshot = useMemo(() => {
    if (externalGraphSnapshot) return externalGraphSnapshot;
    return snapshotCache({
      sessionId,
      explorations,
      summaries,
      flowchartHints,
      wikiPersistStatus,
    });
  }, [externalGraphSnapshot, sessionId, explorations, summaries, flowchartHints, wikiPersistStatus]);

  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => {
      setSpinnerFrameIndex((prev) => (prev + 1) % pulseFrames.length);
    }, 160);
    return () => clearInterval(timer);
  }, [hasRunning]);

  if (explorations.length === 0) {
    return <text fg={colors.fg.muted}>Waiting for explorations...</text>;
  }

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {/* Single-rail chronological stream */}
      <box style={{ width: '100%', flexDirection: 'column' }}>
        {showCacheBadge && (
          <text fg={colors.fg.dim}>
            <span>{'['}</span>
            <CacheBadge status={cacheStatus} reason={cacheReason} />
            <span>{']'}</span>
          </text>
        )}
        {replayOnlyHint && (
          <text fg={colors.fg.dim}>{`[replay-only] ${replayOnlyHint}`}</text>
        )}
        {mode === 'flowchart' ? (
          <box style={{ width: '100%', flexDirection: 'column' }}>
            <text fg={colors.accent.secondary}>{'flowchart view'}</text>
            <FlowGraphView
              snapshot={graphSnapshot}
              availableWidth={availableWidth}
            />
          </box>
        ) : (
          <ExplorationTimeline
            explorations={explorations}
            summaries={summaries}
            persistResults={persistResults}
            wikiPersistStatus={wikiPersistStatus}
            pendingSummaryCount={pendingSummaryCount}
            availableWidth={availableWidth}
            spinnerFrame={pulseFrames[spinnerFrameIndex]}
          />
        )}
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

interface ExplorationTimelineProps {
  explorations: Exploration[];
  summaries: Record<string, string>;
  persistResults?: Record<string, PersistResult>;
  wikiPersistStatus?: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
  pendingSummaryCount: number;
  availableWidth: number;
  spinnerFrame: string;
}

function ExplorationTimeline(props: ExplorationTimelineProps): ReactNode {
  const {
    explorations,
    summaries,
    persistResults,
    wikiPersistStatus,
    pendingSummaryCount,
    availableWidth,
    spinnerFrame,
  } = props;
  const timelineEntries = sortTimelineEntries(explorations);
  let latestRunningOriginalIdx = -1;
  for (let i = timelineEntries.length - 1; i >= 0; i--) {
    if (timelineEntries[i].exploration.status === 'running') {
      latestRunningOriginalIdx = timelineEntries[i].originalIndex;
      break;
    }
  }
  const focusOriginalIdx = latestRunningOriginalIdx >= 0
    ? latestRunningOriginalIdx
    : timelineEntries[timelineEntries.length - 1]?.originalIndex ?? -1;

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {timelineEntries.map(({ exploration, originalIndex }, timelineIndex) => {
        const isGenerating = !summaries[exploration.id]
          && exploration.status === 'complete'
          && pendingSummaryCount > 0;
        const isActive = originalIndex === focusOriginalIdx;

        return (
          <ExplorationCard
            key={exploration.id}
            exploration={exploration}
            showRailConnector={timelineIndex < timelineEntries.length - 1}
            isActive={isActive}
            spinnerFrame={spinnerFrame}
            summary={summaries[exploration.id]}
            persistStatus={wikiPersistStatus?.[exploration.id]}
            persistResult={persistResults?.[exploration.id]}
            isGenerating={isGenerating}
            availableWidth={availableWidth}
          />
        );
      })}
    </box>
  );
}

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
