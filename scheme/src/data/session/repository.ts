import * as fs from 'node:fs';
import { findLatestSession } from './claude-project';
import {
  buildTreeFromEvents,
  extractExplorationsFromSession,
  extractSessionStats,
  parseJsonlFile,
} from './jsonl-session';
import type { ObserverSessionSnapshot } from '../protocol/observer-protocol';
import type { ActivityTree } from '../../domain/types';

export interface SessionRepository {
  resolveActiveSession(input: {
    cwd: string;
    explicitSessionId?: string;
  }): Promise<{ sessionId: string; sessionPath: string } | null>;
  readSnapshot(input: {
    sessionPath: string;
    previous?: { mtimeMs: number; sessionPath: string } | null;
  }): Promise<{
    changed: boolean;
    mtimeMs: number;
    snapshot?: ObserverSessionSnapshot;
  }>;
}

export class FileSessionRepository implements SessionRepository {
  async resolveActiveSession(input: {
    cwd: string;
    explicitSessionId?: string;
  }): Promise<{ sessionId: string; sessionPath: string } | null> {
    const sessionPath = withFlowSessionId(input.explicitSessionId, () => findLatestSession(input.cwd));
    if (!sessionPath) return null;
    return {
      sessionId: input.explicitSessionId || sessionIdFromPath(sessionPath),
      sessionPath,
    };
  }

  async readSnapshot(input: {
    sessionPath: string;
    previous?: { mtimeMs: number; sessionPath: string } | null;
  }): Promise<{
    changed: boolean;
    mtimeMs: number;
    snapshot?: ObserverSessionSnapshot;
  }> {
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(input.sessionPath).mtimeMs;
    } catch {
      return { changed: false, mtimeMs: 0 };
    }

    if (
      input.previous
      && mtimeMs <= input.previous.mtimeMs
      && input.previous.sessionPath === input.sessionPath
    ) {
      return { changed: false, mtimeMs };
    }

    const sessionContent = fs.readFileSync(input.sessionPath, 'utf-8');
    const events = parseJsonlFile(input.sessionPath, 0, sessionContent);
    const tree = buildTreeFromEvents(events, '') as ActivityTree;
    const explorations = extractExplorationsFromSession(input.sessionPath, sessionContent);
    const stats = extractSessionStats(input.sessionPath, sessionContent);
    const outputTokens = stats.outputTokens;
    const totalTokens = getContextWindowTokens(stats) + outputTokens;
    const tokenDisplay = stats.hasUsageField
      ? `Tok ${formatCompactTokens(totalTokens)}`
      : 'Tok --';
    const runtimeModel = [...events]
      .reverse()
      .find((event) => {
        const model = event.source?.model;
        return typeof model === 'string' && model.length > 0 && model !== 'unknown-model';
      })
      ?.source?.model || 'unknown';

    return {
      changed: true,
      mtimeMs,
      snapshot: {
        sessionPath: input.sessionPath,
        sessionId: sessionIdFromPath(input.sessionPath),
        sourceMtimeMs: mtimeMs,
        explorations,
        tree,
        stats,
        tokenDisplay,
        runtimeModel,
        updatedAt: Date.now(),
      },
    };
  }
}

function withFlowSessionId<T>(sessionId: string | undefined, fn: () => T): T {
  if (!sessionId) return fn();
  const previous = process.env.FLOW_SESSION_ID;
  process.env.FLOW_SESSION_ID = sessionId;
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.FLOW_SESSION_ID;
    } else {
      process.env.FLOW_SESSION_ID = previous;
    }
  }
}

function sessionIdFromPath(sessionPath: string): string {
  return sessionPath.split('/').pop()?.replace(/\.jsonl$/, '') || '';
}

function getContextWindowTokens(stats: {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}): number {
  return stats.inputTokens + stats.cacheReadTokens + stats.cacheWriteTokens;
}

function formatCompactTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toString();
}
