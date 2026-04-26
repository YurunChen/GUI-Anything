/**
 * useSessionPolling - 会话轮询与数据获取（增量解析版）
 * 职责：管理 session 文件监听、JSONL 增量解析、tree 和 explorations 构建
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  findLatestSession,
  extractSessionStats,
  extractExplorationsFromSession,
  parseJsonlFile,
  buildTreeFromEvents,
} from '../../../runtime/posthoc';
import { getContextWindowTokens } from '../flow/flow-utils';
import type { ActivityTree } from '../../../core/types';
import type { Exploration } from '../../../runtime/posthoc';
import * as fs from 'node:fs';

interface SessionData {
  sessionPath: string;
  sessionId: string;
  explorations: Exploration[];
  tree: ActivityTree | null;
  tokenDisplay: string;
  runtimeModel: string;
}

export function useSessionPolling(cwd: string, explicitSessionId?: string) {
  const [data, setData] = useState<SessionData>({
    sessionPath: '',
    sessionId: explicitSessionId || '',
    explorations: [],
    tree: null,
    tokenDisplay: 'Tok --',
    runtimeModel: 'unknown',
  });

  const lastMtimeMsRef = useRef<number>(0);
  const lastSessionPathRef = useRef<string>('');

  const tick = useCallback(() => {
    const sessionPathResult = findLatestSession(cwd);
    if (!sessionPathResult) return;

    let mtimeMs = 0;
    try {
      const st = fs.statSync(sessionPathResult);
      mtimeMs = st.mtimeMs;
    } catch {
      return;
    }

    // Skip work if file has not changed.
    if (mtimeMs <= lastMtimeMsRef.current && lastSessionPathRef.current === sessionPathResult) {
      return;
    }
    lastMtimeMsRef.current = mtimeMs;
    lastSessionPathRef.current = sessionPathResult;

    const sessionContent = fs.readFileSync(sessionPathResult, 'utf-8');
    const events = parseJsonlFile(sessionPathResult, 0, sessionContent);
    const tree = buildTreeFromEvents(events, '') as ActivityTree;
    const explorations = extractExplorationsFromSession(sessionPathResult, sessionContent);

    // Stats for token display
    const stats = extractSessionStats(sessionPathResult, sessionContent);
    const contextTokens = getContextWindowTokens(stats);
    const outputTokens = stats.outputTokens;
    const totalTokens = contextTokens + outputTokens;

    let tokenDisplay = 'Tok --';
    // Keep token section visible once usage fields are present,
    // even if provider reports zeros (eg some non-Claude backends).
    if (stats.hasUsageField) {
      tokenDisplay = `Tok ${formatCompactTokens(totalTokens)} (in:${formatCompactTokens(stats.inputTokens)}, out:${formatCompactTokens(outputTokens)}, cache:${formatCompactTokens(stats.cacheReadTokens + stats.cacheWriteTokens)})`;
    }

    const modelFromStream = [...events]
      .reverse()
      .find((event) => {
        const model = event.source?.model;
        return typeof model === 'string' && model.length > 0 && model !== 'unknown-model';
      })
      ?.source?.model;

    const detectedSessionId = sessionPathResult.split('/').pop()?.replace('.jsonl', '') || '';

    setData({
      sessionPath: sessionPathResult,
      sessionId: explicitSessionId || detectedSessionId,
      explorations,
      tree,
      tokenDisplay,
      runtimeModel: modelFromStream || 'unknown',
    });
  }, [cwd, explicitSessionId]);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 500); // OBSERVER_POLL_MS
    return () => clearInterval(interval);
  }, [tick]);

  return data;
}

function formatCompactTokens(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000)}k`;
  }
  return n.toString();
}
