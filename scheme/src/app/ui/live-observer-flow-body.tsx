/**
 * LiveObserverFlowBody - chronological single-rail flow panel.
 *
 * Layout: Timeline — exploration list in strict time order.
 */

import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Exploration,
  FlowGraphSnapshot,
  PersistResult,
  SessionScopedId,
  SummaryItem,
  WikiMatch,
} from '../../data/protocol/observer-protocol';
import type { WorkspaceTreeSnapshot } from '../../data/protocol/workspace-tree';
import { getSummaryItemForExploration } from '../../data/protocol/summary-contract';
import { isExplorationSummarizing } from '../observer/view-model/presentation-summaries';
import { useThemeChrome, useThemeVersion, useTuiTheme } from './theme';
import { chromeHasDecorMotion, resolveSpinnerFrame } from './themes/theme-profile';
import { isFlowMotionEnabled } from './hooks/useFlowMotion';
import { ExplorationCard } from './flow/ExplorationCard';
import { FocusView } from './flow/graph/FocusView';
import { WorkspaceView } from './flow/workspace/WorkspaceView';
import { sortTimelineEntries } from '../observer/view-model/timeline';
import { buildWorkspaceActivityView } from '../observer/view-model/workspace-activity';
import type { WikiWriteChromeView } from '../observer/view-model/wiki-write-chrome';
import { getObserverMessages } from './i18n/observer-messages';
import type { ObserverViewMode } from './flow/observer-hotkeys';
import { useFlowMotionFrame } from './hooks/useFlowMotion';

export { sortTimelineEntries } from '../observer/view-model/timeline';
export type { TimelineEntry } from '../observer/view-model/timeline';

export type LiveObserverFlowBodyProps = {
  explorations: Exploration[];
  summaries: Record<string, string>;
  graphSnapshot: FlowGraphSnapshot;
  wikiPersistResults?: Record<string, PersistResult>;
  wikiWriteChromeByExploration?: Record<string, WikiWriteChromeView>;
  wikiMatchesByExploration: Record<string, WikiMatch | null>;
  pendingSummaryCount: number;
  pendingByExplorationId?: Record<string, boolean>;
  /** Available width for content calculation */
  availableWidth?: number;
  availableHeight?: number;
  sessionBannerHint?: string;
  summaryItems?: Record<SessionScopedId, SummaryItem>;
  workspaceTree?: WorkspaceTreeSnapshot | null;
  mode?: ObserverViewMode;
  /** Calm mode: older cards collapse; only the latest shows full summary. */
  calmMode?: boolean;
  /** @deprecated use theme chrome spinnerIntervalMs; kept for FLOW_NO_ANIMATIONS baseline */
  spinnerIntervalMs?: number;
};

export const LiveObserverFlowBody = memo(function LiveObserverFlowBody(
  props: LiveObserverFlowBodyProps
): ReactNode {
  useThemeVersion();

  const {
    explorations,
    summaries,
    graphSnapshot,
    availableWidth = 80,
    availableHeight = 24,
    sessionBannerHint,
    summaryItems,
    workspaceTree,
    wikiPersistResults,
    wikiWriteChromeByExploration,
    wikiMatchesByExploration,
    pendingSummaryCount,
    pendingByExplorationId = {},
    mode = 'timeline',
    calmMode = false,
    spinnerIntervalMs,
  } = props;
  const chrome = useThemeChrome();
  const tuiTheme = useTuiTheme();
  const motionIntervalMs = spinnerIntervalMs ?? chrome.spinnerIntervalMs;
  const [freshExplorationIds, setFreshExplorationIds] = useState<Set<string>>(() => new Set());
  const [freshSummaryIds, setFreshSummaryIds] = useState<Set<string>>(() => new Set());
  const seenExplorationIdsRef = useRef<Set<string> | null>(null);
  const generatingByExplorationIdRef = useRef<Map<string, boolean> | null>(null);
  const freshTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const summaryFreshTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const hasRunning = explorations.some((item) => item.status === 'running');
  const shouldAnimateSpinner = hasRunning || pendingSummaryCount > 0;
  const timelineMotionFrame = useFlowMotionFrame(
    mode === 'timeline' && (
      shouldAnimateSpinner
      || freshExplorationIds.size > 0
      || freshSummaryIds.size > 0
      || chromeHasDecorMotion(chrome)
    ),
    motionIntervalMs,
  );
  const workspaceActivity = useMemo(
    () => (mode === 'workspace' ? buildWorkspaceActivityView(explorations, 14, workspaceTree) : null),
    [explorations, mode, workspaceTree],
  );
  const workspaceMotionFrame = useFlowMotionFrame(
    mode === 'workspace' && (workspaceActivity?.trace.length ?? 0) > 0,
    motionIntervalMs,
  );

  const spinnerFrame = resolveSpinnerFrame(chrome, timelineMotionFrame);

  useEffect(() => {
    const nextIds = new Set(explorations.map((item) => item.id));
    const seenIds = seenExplorationIdsRef.current;

    if (!seenIds) {
      seenExplorationIdsRef.current = nextIds;
      return;
    }

    const addedIds = [...nextIds].filter((id) => !seenIds.has(id));
    seenExplorationIdsRef.current = nextIds;
    if (addedIds.length === 0 || !isFlowMotionEnabled()) return;

    setFreshExplorationIds((prev) => {
      const next = new Set(prev);
      for (const id of addedIds) next.add(id);
      return next;
    });

    for (const id of addedIds) {
      const previousTimer = freshTimersRef.current.get(id);
      if (previousTimer) clearTimeout(previousTimer);
      const timer = setTimeout(() => {
        setFreshExplorationIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        freshTimersRef.current.delete(id);
      }, 2200);
      freshTimersRef.current.set(id, timer);
    }
  }, [explorations]);

  useEffect(() => () => {
    for (const timer of freshTimersRef.current.values()) {
      clearTimeout(timer);
    }
    freshTimersRef.current.clear();
    for (const timer of summaryFreshTimersRef.current.values()) {
      clearTimeout(timer);
    }
    summaryFreshTimersRef.current.clear();
  }, []);

  useEffect(() => {
    const current = new Map<string, boolean>();
    const completedIds: string[] = [];

    for (const exploration of explorations) {
      const summaryItem = getSummaryItemForExploration(summaryItems, exploration.id);
      const isGenerating = isExplorationSummarizing(
        exploration,
        summaryItem,
        pendingByExplorationId[exploration.id] === true,
      );
      current.set(exploration.id, isGenerating);

      const previous = generatingByExplorationIdRef.current?.get(exploration.id);
      const hasSummary = Boolean(summaries[exploration.id]?.trim() || summaryItem?.text?.trim());
      if (previous === true && !isGenerating && hasSummary) {
        completedIds.push(exploration.id);
      }
    }

    generatingByExplorationIdRef.current = current;
    if (completedIds.length === 0 || !isFlowMotionEnabled()) return;

    setFreshSummaryIds((prev) => {
      const next = new Set(prev);
      for (const id of completedIds) next.add(id);
      return next;
    });

    for (const id of completedIds) {
      const previousTimer = summaryFreshTimersRef.current.get(id);
      if (previousTimer) clearTimeout(previousTimer);
      const timer = setTimeout(() => {
        setFreshSummaryIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        summaryFreshTimersRef.current.delete(id);
      }, 1400);
      summaryFreshTimersRef.current.set(id, timer);
    }
  }, [explorations, pendingByExplorationId, summaries, summaryItems]);

  if (explorations.length === 0) {
    const m = getObserverMessages();
    return (
      <box style={{ flexDirection: 'column' }}>
        <text fg={tuiTheme.semantic.label.tertiary}>{m.waitingExplorations}</text>
        <text fg={tuiTheme.semantic.label.quaternary} style={{ marginTop: 1 }}>{m.onboardingHint}</text>
      </box>
    );
  }

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {sessionBannerHint ? (
        <text fg={tuiTheme.semantic.label.quaternary}>{sessionBannerHint}</text>
      ) : null}
      {mode === 'workspace' ? (
        <box
          style={{
            width: '100%',
            flexGrow: 1,
            flexDirection: 'column',
            paddingTop: 1,
            paddingBottom: 1,
          }}
        >
          <WorkspaceView
            view={workspaceActivity ?? buildWorkspaceActivityView([])}
            motionFrame={workspaceMotionFrame}
            availableWidth={availableWidth}
            availableHeight={availableHeight}
          />
        </box>
      ) : mode === 'focus' ? (
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
          <FocusView
            snapshot={graphSnapshot}
            availableWidth={availableWidth}
          />
        </box>
      ) : (
        <>
          <ExplorationTimeline
            explorations={explorations}
            summaries={summaries}
            summaryItems={summaryItems}
            pendingByExplorationId={pendingByExplorationId}
            availableWidth={availableWidth}
            spinnerFrame={spinnerFrame}
            motionFrame={timelineMotionFrame}
            calmMode={calmMode}
            wikiPersistResults={wikiPersistResults}
            wikiWriteChromeByExploration={wikiWriteChromeByExploration}
            wikiMatchesByExploration={wikiMatchesByExploration}
            freshExplorationIds={freshExplorationIds}
            freshSummaryIds={freshSummaryIds}
          />
        </>
      )}
    </box>
  );
});

interface ExplorationTimelineProps {
  explorations: Exploration[];
  summaries: Record<string, string>;
  pendingByExplorationId?: Record<string, boolean>;
  availableWidth: number;
  spinnerFrame: string;
  motionFrame: number;
  calmMode: boolean;
  summaryItems?: Record<SessionScopedId, SummaryItem>;
  wikiPersistResults?: Record<string, PersistResult>;
  wikiWriteChromeByExploration?: Record<string, WikiWriteChromeView>;
  wikiMatchesByExploration: Record<string, WikiMatch | null>;
  freshExplorationIds?: Set<string>;
  freshSummaryIds?: Set<string>;
}

function ExplorationTimeline(props: ExplorationTimelineProps): ReactNode {
  const {
    explorations,
    summaries,
    pendingByExplorationId = {},
    availableWidth,
    spinnerFrame,
    motionFrame,
    calmMode,
    summaryItems,
    wikiPersistResults,
    wikiWriteChromeByExploration,
    wikiMatchesByExploration,
    freshExplorationIds = new Set(),
    freshSummaryIds = new Set(),
  } = props;
  const timelineEntries = useMemo(() => sortTimelineEntries(explorations), [explorations]);
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

        // Only animating cards consume spinnerFrame; feeding a stable '' to the
        // rest lets memo skip their re-render on every 160ms spinner tick.
        const cardIsAnimating = exploration.status === 'running' || isGenerating;
        const cardUsesMotion = cardIsAnimating
          || freshExplorationIds.has(exploration.id)
          || freshSummaryIds.has(exploration.id);

        return (
          <ExplorationCard
            key={exploration.id}
            exploration={exploration}
            calmMode={calmMode}
            isLatestExploration={exploration.id === latestExplorationId}
            isSummaryFresh={freshSummaryIds.has(exploration.id)}
            spinnerFrame={cardIsAnimating ? spinnerFrame : ''}
            motionFrame={cardUsesMotion ? motionFrame : 0}
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
