import type { ReactNode } from 'react';
import { useMemo, useCallback, useRef, useEffect } from 'react';
import { createLogger } from '../../utils/logger';

import { FlowObserverShell } from '../ui/flow/FlowObserverShell';
import { buildSessionBanner } from '../../services/session/session-banner';
import { getSessionBundleService } from '../../services/session/session-bundle-service';
import { bundleHasDisplayData } from '../../data/wiki/session-bundle-mappers';
import { getObserverMessages } from '../ui/i18n/observer-messages';

import { useSessionPolling } from './hooks/useSessionPolling';
import { useExplorationSummaries } from './hooks/useExplorationSummaries';
import { useWikiCurator } from './hooks/useWikiCurator';
import { useWikiMatches } from './hooks/useWikiMatches';
import { useGraphSnapshot } from './hooks/useGraphSnapshot';
import { useGraphConsolidation } from './hooks/useGraphConsolidation';
import { useWorkspaceTreeSnapshot } from './hooks/useWorkspaceTreeSnapshot';
import { buildFlowGraphSnapshot } from '../../data/protocol/session-flow-projector';
import { useNotification } from './hooks/useNotification';
import { useEvolutionExport } from './hooks/useEvolutionExport';
import { fileWikiAudit } from '../../services/wiki/audit-service';
import { formatKnowledgeExcerpt } from '../../services/wiki/wiki-text-utils';
import { resolveLiveCodingPersona } from '../../services/evolution/live-persona';
import { buildPersonalityStripInfo } from './view-model/personality-strip-view';

const log = createLogger('observer');
let observerBootLogged = false;

export function LiveObserverContainer(): ReactNode {
  const cwd = process.env.FLOW_PROJECT_DIR || process.cwd();
  const explicitSessionId = process.env.FLOW_SESSION_ID || '';
  const resumeModeRaw = process.env.FLOW_RESUME_MODE || '';
  const summaryModel = (process.env.FLOW_SUMMARY_MODEL || process.env.CLAUDE_MODEL || '').trim();
  const bootLoggedRef = useRef(observerBootLogged);
  const workspaceTree = useWorkspaceTreeSnapshot(cwd);

  useEffect(() => {
    if (bootLoggedRef.current) return;
    bootLoggedRef.current = true;
    observerBootLogged = true;
    log.info('observer started', {
      sessionId: explicitSessionId || undefined,
      mode: resumeModeRaw || 'auto_latest',
      logLevel: process.env.FLOW_LOG_LEVEL || 'info',
    });
  }, [cwd, resumeModeRaw, explicitSessionId]);

  const {
    sessionPath,
    sessionId,
    sourceMtimeMs,
    bindingIntent,
    explorations,
    tree,
    tokenDisplay,
    runtimeModel,
    awaitingPickerSelection,
  } = useSessionPolling(cwd, {
    explicitSessionId: explicitSessionId || undefined,
    resumeModeRaw: resumeModeRaw || undefined,
  });

  const sessionBound = Boolean(sessionPath.trim());
  const wikiBundleHasData = useMemo(() => {
    const sid = sessionId.trim();
    if (!sid) return false;
    return bundleHasDisplayData(getSessionBundleService().load(sid));
  }, [sessionId]);

  const {
    summaries: explorationSummaries,
    flowchartHints,
    pendingCount: pendingSummaryCount,
    pendingByExplorationId,
    summaryItems,
    sessionIntent,
    runtime,
  } = useExplorationSummaries(
    explorations,
    sessionId,
    sessionPath,
    summaryModel,
    bindingIntent,
    wikiBundleHasData,
    sessionBound,
  );

  const pickerStatusHint = useMemo(() => {
    if (!awaitingPickerSelection) return undefined;
    return getObserverMessages().statusAwaitingPicker;
  }, [awaitingPickerSelection]);

  const sessionBannerHint = useMemo(() => {
    if (runtime.phase !== 'replay') return undefined;
    const m = getObserverMessages();
    const banner = buildSessionBanner({
      presentation: runtime.presentation,
      explorations,
      summaryItems,
    });
    if (!banner.detailLine) return m.replayBannerBody;
    return `${m.replayBannerBody} · ${banner.detailLine}`;
  }, [runtime, explorations, summaryItems]);

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
  } = useGraphSnapshot({
    sessionId,
    sessionPath,
    sourceMtimeMs,
    explorations,
    summaries: explorationSummaries,
    flowchartHints: mergedFlowchartHints,
    wikiPersistStatus: explorationPersistStatus,
  });

  const wikiMatchesByExploration = useWikiMatches(
    explorations,
    sessionId,
    sessionPath,
    runtime.presentation.allowWikiLiveSearch,
  );
  const personalityStripInfo = useMemo(
    () => buildPersonalityStripInfo(resolveLiveCodingPersona({
      graphSnapshot,
      explorations,
      flowchartHints: mergedFlowchartHints,
      explorationPersistStatus,
      wikiMatchesByExploration,
    })) ?? undefined,
    [graphSnapshot, explorations, mergedFlowchartHints, explorationPersistStatus, wikiMatchesByExploration],
  );

  const {
    notificationEnabled,
    sendManualSnapshot,
    lastNotifyStatus,
  } = useNotification(sessionId, tree ?? undefined, summaryItems);

  const { exportHtml, lastExportStatus } = useEvolutionExport();

  const handleFileWikiAudit = useCallback((): { filed: boolean; targetId?: string } => {
    if (!sessionId) return { filed: false };
    const bundleService = getSessionBundleService();
    const allowLiveSearch = runtime.presentation.allowWikiLiveSearch;
    for (const exploration of [...explorations].reverse()) {
      if (exploration.status !== 'complete') continue;
      const match = bundleService.ensureExplorationRetrieval(
        sessionId,
        exploration,
        sessionPath,
        allowLiveSearch,
      );
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
  }, [explorations, sessionId, sessionPath, runtime.presentation.allowWikiLiveSearch]);

  return (
    <FlowObserverShell
      explorations={explorations}
      tree={tree}
      sessionId={sessionId}
      tokenDisplay={tokenDisplay}
      runtimeModel={runtimeModel}
      wikiExtractedCount={wikiExtractedCount}
      explorationSummaries={explorationSummaries}
      graphSnapshot={graphSnapshot}
      explorationPersistStatus={explorationPersistStatus}
      pendingSummaryCount={pendingSummaryCount}
      pendingByExplorationId={pendingByExplorationId}
      recentInspirations={recentInspirations}
      onSaveInspiration={saveInspiration}
      persistResults={explorationPersistResults}
      wikiWriteChromeByExploration={wikiWriteChromeByExploration}
      wikiMatchesByExploration={wikiMatchesByExploration}
      sessionPresentationMode={runtime.phase}
      sessionBannerHint={sessionBannerHint}
      flowBodyVisible={runtime.visibility === 'show'}
      summaryItems={summaryItems}
      workspaceTree={workspaceTree}
      sessionIntent={sessionIntent}
      onSendSnapshot={notificationEnabled ? sendManualSnapshot : undefined}
      onFileWikiAudit={handleFileWikiAudit}
      onExportHtml={exportHtml}
      exportStatus={lastExportStatus}
      notifyStatus={pickerStatusHint ?? lastNotifyStatus}
      personalityStripInfo={personalityStripInfo}
    />
  );
}
