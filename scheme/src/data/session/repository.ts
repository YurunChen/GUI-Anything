import * as fs from 'node:fs';
import {
  resolveSessionBinding,
  type SessionDiscoveryInput,
  type SessionDiscoveryMode,
} from './session-discovery';
import {
  buildTreeFromEvents,
  extractExplorationsFromSession,
  extractSessionStats,
  parseJsonlFile,
} from './jsonl-session';
import type { ObserverSessionSnapshot } from '../protocol/observer-protocol';
import type { ActivityTree } from '../../domain/types';
import { createLogger } from '../../utils/logger';

const log = createLogger('session');

export interface SessionBindingContext {
  mode: SessionDiscoveryMode;
  explicitSessionId?: string;
  pinnedSessionId?: string;
  baselineMtimes?: Map<string, number>;
}

export interface SessionRepository {
  resolveActiveSession(input: {
    cwd: string;
    binding: SessionBindingContext;
  }): Promise<{ sessionId: string; sessionPath: string; source: string } | null>;
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
    binding: SessionBindingContext;
  }): Promise<{ sessionId: string; sessionPath: string; source: string } | null> {
    const discoveryInput: SessionDiscoveryInput = {
      cwd: input.cwd,
      mode: input.binding.mode,
      explicitSessionId: input.binding.explicitSessionId,
      pinnedSessionId: input.binding.pinnedSessionId,
      baselineMtimes: input.binding.baselineMtimes,
    };
    const resolved = resolveSessionBinding(discoveryInput);
    if (!resolved) {
      log.debug('no active session', { mode: input.binding.mode });
      return null;
    }
    log.debug('active session resolved', {
      sessionId: resolved.sessionId,
      source: resolved.source,
      mode: input.binding.mode,
    });
    return {
      sessionId: resolved.sessionId,
      sessionPath: resolved.sessionPath,
      source: resolved.source,
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

    const sessionId = sessionIdFromPath(input.sessionPath);
    log.debug('session snapshot updated', {
      sessionId,
      mtimeMs,
      explorationCount: explorations.length,
    });
    return {
      changed: true,
      mtimeMs,
      snapshot: {
        sessionPath: input.sessionPath,
        sessionId,
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
