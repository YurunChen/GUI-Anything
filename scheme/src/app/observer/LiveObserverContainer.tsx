import type { ReactNode } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  type PotentialDirection,
} from '../../services/ai/flow-summaries';
import type { WikiMatch } from '../../data/protocol/observer-protocol';
import { DefaultWikiMatchService } from '../../services/wiki/match-service';
import { DefaultPotentialDirectionsService } from '../../services/ai/potential-directions-service';

import { FlowObserverShell } from '../ui/flow/FlowObserverShell';
import { WIKI_SEARCH_THRESHOLD } from '../../constants/flow-constants';
import { deriveSessionBindingState, deriveSessionSummaryPolicy } from '../../services/session/session-binding-policy';

import { useSessionPolling } from './hooks/useSessionPolling';
import { useExplorationSummaries } from './hooks/useExplorationSummaries';
import { useWikiPersistence } from './hooks/useWikiPersistence';
import { useGraphSnapshot } from './hooks/useGraphSnapshot';
import { useGraphConsolidation } from './hooks/useGraphConsolidation';
import { buildFlowGraphSnapshot } from '../ui/flow/graph/graph-builder';

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
  const summaryPolicy = useMemo(
    () => deriveSessionSummaryPolicy(bindingIntent),
    [bindingIntent],
  );

  const {
    summaries: explorationSummaries,
    flowchartHints,
    persistMeta: explorationPersistMeta,
    pendingCount: pendingSummaryCount,
    // Provenance for UI badges
    cacheStatus,
    cacheReason,
  } = useExplorationSummaries(explorations, sessionId, sessionPath, summaryModel, summaryPolicy);
  const replayOnlyHint = useMemo(() => {
    if (summaryPolicy.allowRegen) return '';
    const missingCompleteSummaries = explorations.filter((item) => (
      item.status === 'complete'
      && item.nodes.length > 0
      && !explorationSummaries[item.id]
    )).length;
    if (missingCompleteSummaries <= 0) return '';
    return `${missingCompleteSummaries} summaries unavailable (strict replay)`;
  }, [summaryPolicy.allowRegen, explorations, explorationSummaries]);
  const {
    wikiExtractedCount,
    explorationPersistStatus,
    explorationPersistResults,
    recentInspirations,
    saveInspiration,
  } = useWikiPersistence(explorations, explorationSummaries, explorationPersistMeta, sessionId);
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

  const [lastUserQuery, setLastUserQuery] = useState('');
  const [wikiMatch, setWikiMatch] = useState<WikiMatch | null>(null);
  const wikiMatchServiceRef = useRef(new DefaultWikiMatchService());
  useEffect(() => {
    const latest = explorations[explorations.length - 1];
    if (!latest) {
      setWikiMatch(null);
      return;
    }
    const query = latest.question;
    if (!query || query.length < 5 || query === lastUserQuery) return;
    setLastUserQuery(query);
    let cancelled = false;
    wikiMatchServiceRef.current
      .searchByQuery(query, WIKI_SEARCH_THRESHOLD)
      .then((match) => {
        if (!cancelled) setWikiMatch(match);
      });
    return () => {
      cancelled = true;
    };
  }, [explorations, lastUserQuery]);

  const [potentialDirections, setPotentialDirections] = useState<PotentialDirection[]>([]);
  const [directionsStatus, setDirectionsStatus] = useState<'idle' | 'generating' | 'ready' | 'insufficient' | 'error'>('idle');
  const [directionsMessage, setDirectionsMessage] = useState('');
  const potentialDirectionsServiceRef = useRef(new DefaultPotentialDirectionsService());

  const handleTriggerDirections = useCallback(() => {
    setDirectionsStatus('generating');
    setDirectionsMessage('');
    potentialDirectionsServiceRef.current.suggestFromExplorations({
      runtimeModel,
      explorations,
      summaries: explorationSummaries,
      summaryModel: summaryModel || undefined,
    })
      .then((result) => {
        if (result.status === 'insufficient') {
          setPotentialDirections([]);
          setDirectionsStatus('insufficient');
          setDirectionsMessage(result.message || '当前证据不足，请继续补充探索。');
        } else {
          setPotentialDirections(result.directions);
          setDirectionsStatus('ready');
          setDirectionsMessage('');
        }
      })
      .catch(() => {
        setPotentialDirections([]);
        setDirectionsStatus('error');
        setDirectionsMessage('方向建议生成失败，请稍后重试。');
      });
  }, [explorations, explorationSummaries, runtimeModel, summaryModel]);

  return (
    <FlowObserverShell
      explorations={explorations}
      tree={tree}
      sessionPath={sessionPath}
      sessionId={sessionId}
      tokenDisplay={tokenDisplay}
      runtimeModel={runtimeModel}
      wikiExtractedCount={wikiExtractedCount}
      wikiMatch={wikiMatch}
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
      cacheStatus={cacheStatus}
      cacheReason={cacheReason}
      replayOnlyHint={replayOnlyHint || undefined}
      flowBodyVisible={bindingState.visibility === 'show'}
    />
  );
}
