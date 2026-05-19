import type { ReactNode } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  type PotentialDirection,
} from '../../services/ai/flow-summaries';
import type { WikiMatch, SummaryItem } from '../../data/protocol/observer-protocol';
import { DefaultWikiMatchService } from '../../services/wiki/match-service';
import { DefaultPotentialDirectionsService } from '../../services/ai/potential-directions-service';

import { FlowObserverShell } from '../ui/flow/FlowObserverShell';
import { WIKI_SEARCH_THRESHOLD } from '../../constants/flow-constants';

import { useSessionPolling } from './hooks/useSessionPolling';
import { useExplorationSummaries } from './hooks/useExplorationSummaries';
import { useWikiPersistence } from './hooks/useWikiPersistence';
import { useNotification } from './hooks/useNotification';

export function LiveObserverContainer(): ReactNode {
  const cwd = process.env.FLOW_PROJECT_DIR || process.cwd();
  const explicitSessionId = process.env.FLOW_SESSION_ID || '';
  const summaryModel = (process.env.CLAUDE_MODEL || '').trim();

  const {
    sessionPath,
    sessionId,
    explorations,
    tree,
    tokenDisplay,
    runtimeModel,
  } = useSessionPolling(cwd, explicitSessionId || undefined);

  const {
    summaries: explorationSummaries,
    persistMeta: explorationPersistMeta,
    pendingCount: pendingSummaryCount,
    // Provenance for UI badges
    cacheStatus,
    cacheReason,
    summaryItems,
  } = useExplorationSummaries(explorations, sessionId, sessionPath, summaryModel);

  const {
    wikiExtractedCount,
    explorationPersistStatus,
    explorationPersistResults,
    recentInspirations,
    saveInspiration,
  } = useWikiPersistence(explorations, explorationSummaries, explorationPersistMeta, sessionId);

  // Notification service integration
  const {
    sendManualSnapshot,
    lastNotifyStatus,
  } = useNotification(sessionId, tree ?? undefined, Object.values(explorationSummaries));

  // Derive provenance maps for UI badges
  const summarySources = useMemo(() => {
    const sources: Record<string, SummaryItem['source']> = {};
    for (const [id, item] of Object.entries(summaryItems)) {
      const explorationId = id.split(':')[1];
      if (explorationId) {
        sources[explorationId] = item.source;
      }
    }
    return sources;
  }, [summaryItems]);

  const summaryReasons = useMemo(() => {
    const reasons: Record<string, string> = {};
    for (const [id, item] of Object.entries(summaryItems)) {
      const explorationId = id.split(':')[1];
      if (explorationId && item.reason) {
        reasons[explorationId] = item.reason;
      }
    }
    return reasons;
  }, [summaryItems]);

  const [lastUserQuery, setLastUserQuery] = useState('');
  const [wikiMatch, setWikiMatch] = useState<WikiMatch | null>(null);
  const wikiMatchServiceRef = useRef(new DefaultWikiMatchService());
  useEffect(() => {
    const latest = explorations[explorations.length - 1];
    if (!latest) {
      setWikiMatch(null);
      return;
    }

    // Extract query from question field or from any text in nodes
    let query = latest.question;

    // If question is empty, try to extract from nodes (user messages, responses)
    if (!query || query.trim() === '') {
      // Look for meaningful text in nodes
      const textNodes = latest.nodes?.filter(n =>
        n.rawText && n.rawText.length > 10 &&
        (n.type === 'response' || !n.type)
      ) || [];

      if (textNodes.length > 0) {
        // Use first meaningful text as query
        query = textNodes[0].rawText || '';
      }
    }

    if (!query || query.length < 5 || query === lastUserQuery) return;
    setLastUserQuery(query);

    // Debug logging
    let cancelled = false;
    wikiMatchServiceRef.current
      .searchByQuery(query, WIKI_SEARCH_THRESHOLD)
      .then((match) => {
        if (!cancelled) setWikiMatch(match);
      })
      .catch((error) => {
        // Silently ignore errors
        if (!cancelled) setWikiMatch(null);
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
      explorationPersistStatus={explorationPersistStatus}
      pendingSummaryCount={pendingSummaryCount}
      potentialDirections={potentialDirections}
      directionsStatus={directionsStatus}
      directionsMessage={directionsMessage}
      recentInspirations={recentInspirations}
      onSaveInspiration={saveInspiration}
      onTriggerDirections={handleTriggerDirections}
      // Provenance for UI badges (Phase 0)
      summarySources={summarySources}
      summaryReasons={summaryReasons}
      persistResults={explorationPersistResults}
      cacheStatus={cacheStatus}
      cacheReason={cacheReason}
      // Notification integration
      onSendSnapshot={sendManualSnapshot}
      notifyStatus={lastNotifyStatus}
    />
  );
}
