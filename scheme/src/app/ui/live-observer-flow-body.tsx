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
  FlowchartHint,
  FlowGraphSnapshot,
  PersistResult,
  SessionScopedId,
  SummaryItem,
  WikiMatch,
} from '../../data/protocol/observer-protocol';
import { getSummaryItemForExploration } from '../../data/protocol/summary-contract';
import { isExplorationSummarizing } from '../observer/view-model/presentation-summaries';
import type { SessionPresentationMode } from '../../services/session/session-presentation-policy';
import type { PotentialDirection } from '../../services/ai/flow-summaries';
import { colors, pulseFrames, semantic, useThemeVersion } from './theme';
import { ExplorationCard } from './flow/ExplorationCard';
import { FlowGraphView } from './flow/graph/FlowGraphView';
import { createCachedBuilder } from '../observer/view-model/flow-graph-snapshot-cache';
import { truncateFlowText } from '../../utils/flow-text';
import { FlowSectionLabel } from './flow/flow-ui/FlowSectionLabel';
import { flowSpacing } from './flow/flow-ui/flow-spacing';
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
  explorations: Exploration[];
  summaries: Record<string, string>;
  flowchartHints?: Record<string, FlowchartHint>;
  graphSnapshot?: FlowGraphSnapshot;
  wikiPersistStatus?: Record<string, 'saved' | 'updated' | 'skipped' | 'failed' | 'pending'>;
  wikiPersistResults?: Record<string, PersistResult>;
  wikiWriteChromeByExploration?: Record<string, WikiWriteChromeView>;
  pendingSummaryCount: number;
  directionsStatus: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
  directionsMessage: string;
  potentialDirections: PotentialDirection[];
  /** Available width for content calculation */
  availableWidth?: number;
  /** Strict replay mode hint when regeneration is intentionally disabled. */
  sessionPresentationMode?: SessionPresentationMode;
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
    summaries,
    flowchartHints,
    graphSnapshot: externalGraphSnapshot,
    directionsStatus,
    directionsMessage,
    potentialDirections,
    availableWidth = 80,
    sessionPresentationMode = 'live',
    sessionBannerHint,
    summaryItems,
    wikiPersistStatus,
    wikiPersistResults,
    wikiWriteChromeByExploration,
    pendingSummaryCount,
    mode = 'exploration',
    calmMode = false,
    spinnerIntervalMs = 160,
  } = props;
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
  const hasRunning = explorations.some((item) => item.status === 'running');
  const wikiMatchesByExploration = useWikiMatches(explorations, sessionId);
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
    }, spinnerIntervalMs);
    return () => clearInterval(timer);
  }, [hasRunning, spinnerIntervalMs]);

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

      {sessionPresentationMode !== 'replay' ? (
        <NextPanel
          status={directionsStatus}
          message={directionsMessage}
          directions={potentialDirections}
        />
      ) : null}
    </box>
  );
});

interface ExplorationTimelineProps {
  sessionId: string;
  explorations: Exploration[];
  summaries: Record<string, string>;
  pendingSummaryCount: number;
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
          pendingSummaryCount,
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

interface NextPanelProps {
  status: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
  message: string;
  directions: PotentialDirection[];
}

function NextPanel({ status, message, directions }: NextPanelProps): ReactNode {
  if (status === 'idle') return null;

  const m = getObserverMessages();

  const panelStyle = {
    width: '100%' as const,
    flexDirection: 'column' as const,
    marginTop: flowSpacing.cardGap,
    paddingLeft: flowSpacing.cardPadX,
    paddingRight: flowSpacing.cardPadX,
    backgroundColor: semantic.fill.grouped,
    border: ['left'] as ['left'],
    borderColor: semantic.tintMuted,
  };

  if (status === 'generating') {
    return (
      <box style={panelStyle}>
        <FlowSectionLabel>{m.nextGenerating}</FlowSectionLabel>
      </box>
    );
  }

  if (status === 'insufficient') {
    return (
      <box style={panelStyle}>
        <FlowSectionLabel>{m.nextInsufficient}</FlowSectionLabel>
        <text fg={semantic.label.secondary}>{message || m.nextInsufficientHint}</text>
      </box>
    );
  }

  if (status === 'error') {
    return (
      <box style={panelStyle}>
        <text fg={semantic.destructive}>{m.nextError}</text>
      </box>
    );
  }

  return (
    <box style={panelStyle}>
      <FlowSectionLabel>{m.nextDirections}</FlowSectionLabel>
      {directions.map((item, idx) => (
        <box key={`dir_${idx}`} style={{ width: '100%', flexDirection: 'column', marginTop: idx > 0 ? 1 : 0 }}>
          <text fg={semantic.label.primary}>{`${idx + 1}. ${item.direction}`}</text>
          <text fg={semantic.label.secondary}>{m.nextWhy(truncateFlowText(item.why, 40))}</text>
          <text fg={semantic.label.tertiary}>
            {m.nextAction(truncateFlowText(item.nextAction, 30), item.confidence)}
          </text>
        </box>
      ))}
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
