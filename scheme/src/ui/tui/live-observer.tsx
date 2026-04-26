/**
 * Live Observer - Entry point (简化版)
 *
 * Responsibilities:
 * - Compose hooks for data, summaries, wiki
 * - Pass data to FlowObserverShell for rendering
 *
 * Architecture: Thin container, logic delegated to hooks
 */

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type { ReactNode } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';

import type { Exploration } from '../../runtime/posthoc';
import {
  generatePotentialDirectionsAI,
  type PotentialDirection,
} from '../../core/flow-summaries';
import { searchWiki, type WikiMatch } from '../../runtime/wiki-search';

import { FlowObserverShell } from './flow/FlowObserverShell';
import { WIKI_SEARCH_THRESHOLD } from './flow/flow-constants';

import { useSessionPolling } from './hooks/useSessionPolling';
import { useExplorationSummaries } from './hooks/useExplorationSummaries';
import { useWikiPersistence } from './hooks/useWikiPersistence';

function LiveObserverContainer(): ReactNode {
  const cwd = process.env.FLOW_PROJECT_DIR || process.cwd();
  const explicitSessionId = process.env.FLOW_SESSION_ID || '';
  const summaryModel = (process.env.CLAUDE_MODEL || '').trim();

  // Session polling: data, tree, tokens
  const {
    sessionPath,
    sessionId,
    explorations,
    tree,
    tokenDisplay,
    runtimeModel,
  } = useSessionPolling(cwd, explicitSessionId || undefined);

  // Summary generation
  const {
    summaries: explorationSummaries,
    persistMeta: explorationPersistMeta,
    pendingCount: pendingSummaryCount,
  } = useExplorationSummaries(explorations, sessionId, summaryModel);

  // Wiki auto-extract + notes
  const {
    wikiExtractedCount,
    explorationPersistStatus,
    recentInspirations,
    saveInspiration,
  } = useWikiPersistence(explorations, explorationSummaries, explorationPersistMeta, sessionId);

  // Wiki search
  const [lastUserQuery, setLastUserQuery] = useState('');
  const [wikiMatch, setWikiMatch] = useState<WikiMatch | null>(null);
  useEffect(() => {
    const latest = explorations[explorations.length - 1];
    if (!latest) {
      setWikiMatch(null);
      return;
    }
    const query = latest.question;
    if (!query || query.length < 5 || query === lastUserQuery) return;
    // Trigger wiki matching as soon as a new user question appears in session.
    const match = searchWiki(query, WIKI_SEARCH_THRESHOLD);
    setWikiMatch(match);
    setLastUserQuery(query);
  }, [explorations, lastUserQuery]);

  // Potential directions
  const [potentialDirections, setPotentialDirections] = useState<PotentialDirection[]>([]);
  const [directionsStatus, setDirectionsStatus] = useState<'idle' | 'generating' | 'ready' | 'insufficient' | 'error'>('idle');
  const [directionsMessage, setDirectionsMessage] = useState('');

  const handleTriggerDirections = useCallback(() => {
    const completed = explorations.filter((e) => e.status === 'complete');
    if (completed.length < 2) {
      setDirectionsStatus('insufficient');
      setDirectionsMessage('当前证据不足：至少需要2轮已完成探索。');
      return;
    }
    const hasEvidence = completed.some((e) =>
      e.nodes.some((n) => n.type === 'tool' || n.type === 'response' || n.type === 'result')
    );
    if (!hasEvidence) {
      setDirectionsStatus('insufficient');
      setDirectionsMessage('当前证据不足：尚未观察到有效工具或响应输出。');
      return;
    }

    setDirectionsStatus('generating');
    setDirectionsMessage('');

    const context = completed.slice(-5).map((e) => ({
      id: e.id,
      question: e.question,
      summary: explorationSummaries[e.id],
      toolCount: e.nodes.filter((n) => n.type === 'tool').length,
      errorCount: e.nodes.filter((n) => n.type === 'error' || n.status === 'error').length,
    }));

    generatePotentialDirectionsAI(runtimeModel, context, summaryModel || undefined)
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
    />
  );
}

export function LiveObserverView(): ReactNode {
  return <LiveObserverContainer />;
}

export async function renderLiveObserver(_cwd?: string): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  const root = createRoot(renderer);
  root.render(<LiveObserverView />);
}
