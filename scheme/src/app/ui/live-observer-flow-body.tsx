/**
 * LiveObserverFlowBody - chronological single-rail flow panel.
 *
 * Layout: Timeline — exploration list in strict time order.
 */

import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import type {
  Exploration,
  FlowchartHint,
  FlowGraphSnapshot,
  PersistResult,
  SessionScopedId,
  SummaryItem,
  WikiMatch,
} from '../../data/protocol/observer-protocol';
import { getSummaryItemForExploration } from '../../data/protocol/summary-contract';
import { isExplorationSummarizing } from '../observer/view-model/presentation-summaries';
import { colors, pulseFrames, useThemeVersion } from './theme';
import { ExplorationCard } from './flow/ExplorationCard';
import { FlowGraphView } from './flow/graph/FlowGraphView';
import { createCachedBuilder } from '../observer/view-model/flow-graph-snapshot-cache';
import { useWikiMatches } from '../observer/hooks/useWikiMatches';
import { sortTimelineEntries } from '../observer/view-model/timeline';
import type { WikiWriteChromeView } from '../observer/view-model/wiki-write-chrome';
import { getObserverMessages } from './i18n/observer-messages';

export { sortTimelineEntries } from '../observer/view-model/timeline';
export type { TimelineEntry } from '../observer/view-model/timeline';

/** Ref-stable cached snapshot builder — only rebuilds when ID-level state actually changes. */
const snapshotCache = createCachedBuilder();

export type LiveObserverFlowBodyProps = {
  sessionId?: string;
  sessionPath?: string;
  allowWikiLiveSearch?: boolean;
  explorations: Exploration[];
  summaries: Record<string, string>;
  flowchartHints?: Record<string, FlowchartHint>;
  graphSnapshot?: FlowGraphSnapshot;
  wikiPersistStatus?: Record<string, 'saved' | 'updated' | 'skipped' | 'failed' | 'pending'>;
  wikiPersistResults?: Record<string, PersistResult>;
  wikiWriteChromeByExploration?: Record<string, WikiWriteChromeView>;
  pendingSummaryCount: number;
  pendingByExplorationId?: Record<string, boolean>;
  /** Available width for content calculation */
  availableWidth?: number;
  sessionBannerHint?: string;
  summaryItems?: Record<SessionScopedId, SummaryItem>;
  mode?: 'exploration' | 'flowchart';
  /** Calm mode: older cards collapse; only the latest shows full summary. */
  calmMode?: boolean;
  /** Spinner interval in ms (lower motion when FLOW_NO_ANIMATIONS=1). */
  spinnerIntervalMs?: number;
};

export const LiveObserverFlowBody = memo(function LiveObserverFlowBody(
  props: LiveObserverFlowBodyProps
): ReactNode {
  useThemeVersion();

  const {
    explorations,
    sessionId = 'current',
    sessionPath = '',
    allowWikiLiveSearch = true,
    summaries,
    flowchartHints,
    graphSnapshot: externalGraphSnapshot,
    availableWidth = 80,
    sessionBannerHint,
    summaryItems,
    wikiPersistStatus,
    wikiPersistResults,
    wikiWriteChromeByExploration,
    pendingSummaryCount,
    pendingByExplorationId = {},
    mode = 'exploration',
    calmMode = false,
    spinnerIntervalMs = 160,
  } = props;
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
  const hasRunning = explorations.some((item) => item.status === 'running');
  const shouldAnimateSpinner = hasRunning || pendingSummaryCount > 0;
  const wikiMatchesByExploration = useWikiMatches(
    explorations,
    sessionId,
    sessionPath,
    allowWikiLiveSearch,
  );
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
    if (!shouldAnimateSpinner) return;
    const timer = setInterval(() => {
      setSpinnerFrameIndex((prev) => (prev + 1) % pulseFrames.length);
    }, spinnerIntervalMs);
    return () => clearInterval(timer);
  }, [shouldAnimateSpinner, spinnerIntervalMs]);

  if (explorations.length === 0) {
    const m = getObserverMessages();
    return (
      <box style={{ flexDirection: 'column' }}>
        <text fg={colors.fg.muted}>{m.waitingExplorations}</text>
        <text fg={colors.fg.dim} style={{ marginTop: 1 }}>{m.onboardingHint}</text>
      </box>
    );
  }

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {sessionBannerHint ? (
        <text fg={colors.fg.dim}>{sessionBannerHint}</text>
      ) : null}
      {mode === 'flowchart' ? (
        <box
          style={{
            width: '100%',
            flexGrow: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            paddingTop: 1,
            paddingBottom: 1,
          }}
        >
          <FlowGraphView
            snapshot={graphSnapshot}
            availableWidth={availableWidth}
          />
        </box>
      ) : (
        <ExplorationTimeline
          sessionId={sessionId}
          explorations={explorations}
          summaries={summaries}
          summaryItems={summaryItems}
          pendingSummaryCount={pendingSummaryCount}
          pendingByExplorationId={pendingByExplorationId}
          availableWidth={availableWidth}
          spinnerFrame={pulseFrames[spinnerFrameIndex]}
          calmMode={calmMode}
          wikiPersistStatus={wikiPersistStatus}
          wikiPersistResults={wikiPersistResults}
          wikiWriteChromeByExploration={wikiWriteChromeByExploration}
          wikiMatchesByExploration={wikiMatchesByExploration}
        />
      )}
    </box>
  );
});

interface ExplorationTimelineProps {
  sessionId: string;
  explorations: Exploration[];
  summaries: Record<string, string>;
  pendingSummaryCount: number;
  pendingByExplorationId?: Record<string, boolean>;
  availableWidth: number;
  spinnerFrame: string;
  calmMode: boolean;
  summaryItems?: Record<SessionScopedId, SummaryItem>;
  wikiPersistStatus?: Record<string, 'saved' | 'updated' | 'skipped' | 'failed' | 'pending'>;
  wikiPersistResults?: Record<string, PersistResult>;
  wikiWriteChromeByExploration?: Record<string, WikiWriteChromeView>;
  wikiMatchesByExploration: Record<string, WikiMatch | null>;
}

function ExplorationTimeline(props: ExplorationTimelineProps): ReactNode {
  const {
    sessionId,
    explorations,
    summaries,
    pendingSummaryCount,
    pendingByExplorationId = {},
    availableWidth,
    spinnerFrame,
    calmMode,
    summaryItems,
    wikiPersistStatus,
    wikiPersistResults,
    wikiWriteChromeByExploration,
    wikiMatchesByExploration,
  } = props;
  const timelineEntries = sortTimelineEntries(explorations);
  const latestExplorationId = timelineEntries[timelineEntries.length - 1]?.exploration.id;

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {timelineEntries.map(({ exploration }) => {
        const summaryItem = getSummaryItemForExploration(summaryItems, exploration.id);
        const isGenerating = isExplorationSummarizing(
          exploration,
          summaryItem,
          pendingByExplorationId[exploration.id] === true,
        );
        const wikiMatch = wikiMatchesByExploration[exploration.id] ?? null;

        const wikiChrome = wikiWriteChromeByExploration?.[exploration.id];

        return (
          <ExplorationCard
            key={exploration.id}
            exploration={exploration}
            calmMode={calmMode}
            isLatestExploration={exploration.id === latestExplorationId}
            spinnerFrame={spinnerFrame}
            summary={summaries[exploration.id]}
            summaryItem={summaryItem}
            isGenerating={isGenerating}
            availableWidth={availableWidth}
            wikiMatch={wikiMatch ?? undefined}
            wikiPersistStatus={wikiChrome?.showWriteBadge ? wikiChrome.status : undefined}
            wikiPersistResult={wikiChrome?.result ?? wikiPersistResults?.[exploration.id]}
            wikiTargetId={wikiChrome?.targetId}
            wikiTurnCount={wikiChrome?.turnCount}
          />
        );
      })}
    </box>
  );
}

export {
  charDisplayWidth,
  formatFlowText,
  lineDisplayWidth,
  truncateFlowText,
} from '../../utils/flow-text';
export {
  contentTextColumns,
  flowContentColumns,
  summaryTextColumns,
  summaryTextareaHeight,
  wrapCharLines,
  wrapDisplayLines,
  wrapFlowText,
  wrapFlowTextInPreset,
} from './flow/summary-layout';
export { FlowTextBlock } from './flow/FlowTextBlock';
export type { FlowTextPreset } from './flow/summary-layout';
