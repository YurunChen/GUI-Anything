/**
 * Session discovery — workspace-scoped binding resolution (data layer).
 * Mode strings align with services/session/session-binding-policy.ts
 */

import type { SessionIndex } from '../wiki/session-bundle-types';
import { matchIndexForWorkspace } from './session-index';
import {
  findLatestSession,
  listSessionsForProject,
  sessionPathForId,
} from './claude-project';
import { createLogger } from '../../utils/logger';
import { reportError } from '../../utils/observability';

const log = createLogger('binding');

export type SessionDiscoveryMode =
  | 'auto_latest'
  | 'bind_specific'
  | 'continue'
  | 'continue_picker';

export type SessionBindingSource = 'pinned' | 'index' | 'delta' | 'latest';

export interface ResolvedSessionBinding {
  sessionPath: string;
  sessionId: string;
  source: SessionBindingSource;
}

export interface SessionDiscoveryInput {
  cwd: string;
  mode: SessionDiscoveryMode;
  explicitSessionId?: string;
  manifest?: SessionIndex | null;
  baselineMtimes?: Map<string, number>;
  pinnedSessionId?: string;
}

export function resolveSessionBinding(input: SessionDiscoveryInput): ResolvedSessionBinding | null {
  const pinnedId = input.pinnedSessionId || input.explicitSessionId;

  if (input.mode === 'bind_specific' || input.mode === 'continue') {
    if (!pinnedId) {
      if (input.mode === 'bind_specific') {
        reportError('io', 'pinned binding mode without session id', { mode: input.mode });
        return null;
      }
    } else {
      const sessionPath = sessionPathForId(pinnedId, input.cwd);
      if (!sessionPath) {
        reportError('io', 'pinned session jsonl not found', { sessionId: pinnedId, cwd: input.cwd });
        return null;
      }
      log.debug('session binding resolved', {
        mode: input.mode,
        sessionId: pinnedId,
        source: 'pinned',
      });
      return { sessionPath, sessionId: pinnedId, source: 'pinned' };
    }
  }

  if (input.mode === 'continue_picker') {
    if (pinnedId) {
      const sessionPath = sessionPathForId(pinnedId, input.cwd);
      if (sessionPath) {
        log.debug('session binding resolved', {
          mode: input.mode,
          sessionId: pinnedId,
          source: 'pinned',
        });
        return { sessionPath, sessionId: pinnedId, source: 'pinned' };
      }
    }
    const delta = findPickerDeltaSession(input.cwd, input.baselineMtimes);
    if (delta) {
      log.debug('session binding resolved', {
        mode: input.mode,
        sessionId: delta.sessionId,
        source: delta.source,
      });
      return delta;
    }
    log.debug('session binding unresolved', { mode: input.mode });
    return null;
  }

  const indexEntry = input.manifest ?? matchIndexForWorkspace(input.cwd);
  if (indexEntry?.lastSessionId) {
    const sessionPath = sessionPathForId(indexEntry.lastSessionId, input.cwd);
    if (sessionPath) {
      log.debug('session binding resolved', {
        mode: input.mode,
        sessionId: indexEntry.lastSessionId,
        source: 'index',
      });
      return { sessionPath, sessionId: indexEntry.lastSessionId, source: 'index' };
    }
    log.warn('index session id missing jsonl', {
      mode: input.mode,
      sessionId: indexEntry.lastSessionId,
    });
  }

  const sessionPath = findLatestSession(input.cwd);
  if (!sessionPath) {
    log.debug('session binding unresolved', { mode: input.mode, reason: 'no_jsonl' });
    return null;
  }
  const sessionId = sessionPath.split('/').pop()?.replace(/\.jsonl$/, '') || '';
  if (!sessionId) return null;
  log.debug('session binding resolved', {
    mode: input.mode,
    sessionId,
    source: 'latest',
  });
  return { sessionPath, sessionId, source: 'latest' };
}

function findPickerDeltaSession(
  cwd: string,
  baselineMtimes?: Map<string, number>,
): ResolvedSessionBinding | null {
  if (!baselineMtimes || baselineMtimes.size === 0) return null;

  let best: { session: ReturnType<typeof listSessionsForProject>[number]; score: number } | null = null;
  for (const session of listSessionsForProject(cwd)) {
    const baseline = baselineMtimes.get(session.sessionId);
    if (baseline === undefined) {
      const score = session.mtimeMs;
      if (!best || score > best.score) {
        best = { session, score };
      }
      continue;
    }
    if (session.mtimeMs > baseline) {
      const score = session.mtimeMs - baseline;
      if (!best || score > best.score) {
        best = { session, score };
      }
    }
  }

  if (!best) return null;
  return {
    sessionPath: best.session.path,
    sessionId: best.session.sessionId,
    source: 'delta',
  };
}

export function buildPickerBaselineMtimes(cwd: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const session of listSessionsForProject(cwd)) {
    map.set(session.sessionId, session.mtimeMs);
  }
  return map;
}
