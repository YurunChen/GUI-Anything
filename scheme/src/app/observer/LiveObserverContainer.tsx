import type { ReactNode } from 'react';
import { useMemo, useCallback } from 'react';

import { FlowObserverShell } from '../ui/flow/FlowObserverShell';
import { deriveSessionBindingState } from '../../services/session/session-binding-policy';
import {
  buildSessionBanner,
  deriveSessionPresentationPolicy,
} from '../../services/session/session-presentation-policy';
import { getObserverMessages } from '../ui/i18n/observer-messages';

import { useSessionPolling } from './hooks/useSessionPolling';
import { useExplorationSummaries } from './hooks/useExplorationSummaries';
import { useWikiCurator } from './hooks/useWikiCurator';
import { usePotentialDirections } from './hooks/usePotentialDirections';
import { useGraphSnapshot } from './hooks/useGraphSnapshot';
import { useGraphConsolidation } from './hooks/useGraphConsolidation';
import { buildFlowGraphSnapshot } from './view-model/flow-graph-builder';
import { useNotification } from './hooks/useNotification';
import { matchWikiForExploration } from './hooks/useWikiMatch';
import { fileWikiAudit } from '../../services/wiki/audit-service';
import { formatKnowledgeExcerpt } from '../../services/wiki/wiki-text-utils';

export function LiveObserverContainer(): ReactNode {
  const cwd = process.env.FLOW_PROJECT_DIR || process.cwd();
  const explicitSessionId = process.env.FLOW_SESSION_ID || '';
  const resumeModeRaw = process.env.FLOW_RESUME_MODE || '';
  const summaryModel = (process.env.CLAUDE_MODEL || '').trim();

  const {
    sessionPath,
    sessionId,
    sourceMtimeMs,
    bindingIntent,
    explorations,
    tree,
    tokenDisplay,
    runtimeModel,
  } = useSessionPolling(cwd, {
    explicitSessionId: explicitSessionId || undefined,
    resumeModeRaw: resumeModeRaw || undefined,
  });
  const presentation = useMemo(
    () => deriveSessionPresentationPolicy(bindingIntent),
    [bindingIntent],
  );

  const {
    summaries: explorationSummaries,
    flowchartHints,
    pendingCount: pendingSummaryCount,
    summaryItems,
    sessionIntent,
  } = useExplorationSummaries(explorations, sessionId, sessionPath, summaryModel, presentation);

  const sessionBannerHint = useMemo(() => {
    if (presentation.mode !== 'replay') return undefined;
    const m = getObserverMessages();
    const banner = buildSessionBanner({ presentation, explorations, summaryItems });
    if (!banner.detailLine) return m.replayBannerBody;
    return `${m.replayBannerBody} · ${banner.detailLine}`;
  }, [presentation, explorations, summaryItems]);
  const {
    wikiExtractedCount,
    explorationPersistStatus,
    explorationPersistResults,
    wikiWriteChromeByExploration,
    recentInspirations,
    saveInspiration,
  } = useWikiCurator(explorations, summaryItems, sessionId, sessionIntent);
  const completedExplorationCount = explorations.filter((item) => item.status === 'complete').length;
  const baseGraphSnapshot = useMemo(() => buildFlowGraphSnapshot({
    sessionId: sessionId || 'current',
    explorations,
    summaries: explorationSummaries,
    flowchartHints,
    wikiPersistStatus: explorationPersistStatus,
  }), [sessionId, explorations, explorationSummaries, flowchartHints, explorationPersistStatus]);
  const consolidation = useGraphConsolidation({
    sessionId,
    graphSnapshot: baseGraphSnapshot,
    hints: flowchartHints,
    completedExplorationCount,
    enabled: true,
  });
  const mergedFlowchartHints = consolidation.hintsOverlay ?? flowchartHints;
  const {
    snapshot: graphSnapshot,
    cacheHit: graphCacheHit,
  } = useGraphSnapshot({
    sessionId,
    sessionPath,
    sourceMtimeMs,
    explorations,
    summaries: explorationSummaries,
    flowchartHints: mergedFlowchartHints,
    wikiPersistStatus: explorationPersistStatus,
  });
  const bindingState = deriveSessionBindingState(bindingIntent, {
    explorationCount: explorations.length,
    summaryCount: Object.keys(explorationSummaries).length,
    flowchartHintCount: Object.keys(mergedFlowchartHints).length,
    graphCacheHit,
  });

  const {
    notificationEnabled,
    sendManualSnapshot,
    lastNotifyStatus,
  } = useNotification(sessionId, tree ?? undefined);

  const {
    potentialDirections,
    directionsStatus,
    directionsMessage,
  } = usePotentialDirections({
    runtimeModel,
    explorations,
    summaries: explorationSummaries,
    summaryModel: summaryModel || undefined,
  });

  const handleFileWikiAudit = useCallback((): { filed: boolean; targetId?: string } => {
    if (!sessionId) return { filed: false };
    for (const exploration of [...explorations].reverse()) {
      if (exploration.status !== 'complete') continue;
      const match = matchWikiForExploration(exploration, sessionId);
      if (!match) continue;
      fileWikiAudit({
        targetId: match.entry.id,
        anchor: formatKnowledgeExcerpt(match.entry.content),
        sessionId,
        explorationId: exploration.id,
        request: exploration.question,
        severity: 'medium',
      });
      return { filed: true, targetId: match.entry.id };
    }
    return { filed: false };
  }, [explorations, sessionId]);

  return (
    <FlowObserverShell
      explorations={explorations}
      tree={tree}
      sessionId={sessionId}
      tokenDisplay={tokenDisplay}
      runtimeModel={runtimeModel}
      wikiExtractedCount={wikiExtractedCount}
      explorationSummaries={explorationSummaries}
      flowchartHints={mergedFlowchartHints}
      graphSnapshot={graphSnapshot}
      explorationPersistStatus={explorationPersistStatus}
      pendingSummaryCount={pendingSummaryCount}
      potentialDirections={potentialDirections}
      directionsStatus={directionsStatus}
      directionsMessage={directionsMessage}
      recentInspirations={recentInspirations}
      onSaveInspiration={saveInspiration}
      persistResults={explorationPersistResults}
      wikiWriteChromeByExploration={wikiWriteChromeByExploration}
      sessionPresentationMode={presentation.mode}
      sessionBannerHint={sessionBannerHint}
      flowBodyVisible={bindingState.visibility === 'show'}
      summaryItems={summaryItems}
      sessionIntent={sessionIntent}
      onSendSnapshot={notificationEnabled ? sendManualSnapshot : undefined}
      onFileWikiAudit={handleFileWikiAudit}
      notifyStatus={lastNotifyStatus}
    />
  );
}
