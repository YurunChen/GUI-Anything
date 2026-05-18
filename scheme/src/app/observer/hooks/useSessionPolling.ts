/**
 * useSessionPolling - application adapter for observer session polling.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ActivityTree } from '../../../domain/types';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import { PollingObserverSessionService } from '../../../services/session/observer-session-service';
import {
  resolveSessionBindingIntent,
} from '../../../services/session/session-binding-policy';
import { reportError } from '../../../utils/observability';

interface SessionData {
  sessionPath: string;
  sessionId: string;
  sourceMtimeMs: number;
  explorations: Exploration[];
  tree: ActivityTree | null;
  tokenDisplay: string;
  runtimeModel: string;
}

interface SessionIdentitySnapshot {
  sessionPath: string;
  sessionId: string;
  sourceMtimeMs: number;
  explorations: Exploration[];
}

/** Compare two arrays by stable identity key (id + status order). */
function idsAndStatusMatch(prev: unknown[], next: unknown[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i] as Record<string, unknown>;
    const b = next[i] as Record<string, unknown>;
    if ((a.id as string) !== (b.id as string) || (a.status as string) !== (b.status as string)) return false;
  }
  return true;
}

export function useSessionPolling(cwd: string, input?: {
  explicitSessionId?: string;
  resumeModeRaw?: string;
}) {
  const bindingIntent = useMemo(
    () => resolveSessionBindingIntent({
      explicitSessionId: input?.explicitSessionId,
      resumeModeRaw: input?.resumeModeRaw,
    }),
    [input?.explicitSessionId, input?.resumeModeRaw],
  );
  const boundSessionId = bindingIntent.mode === 'resume_specific' || bindingIntent.mode === 'bind_specific'
    ? bindingIntent.explicitSessionId
    : undefined;
  const [data, setData] = useState<SessionData>({
    sessionPath: '',
    sessionId: boundSessionId || '',
    sourceMtimeMs: 0,
    explorations: [],
    tree: null,
    tokenDisplay: 'Tok --',
    runtimeModel: 'unknown',
  });

  const sessionServiceRef = useRef<PollingObserverSessionService | null>(null);
  if (!sessionServiceRef.current) {
    sessionServiceRef.current = new PollingObserverSessionService();
  }
  const pollingRef = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const tick = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const snapshot = await sessionServiceRef.current!.poll({
        cwd,
        explicitSessionId: boundSessionId,
      });
      if (!snapshot) return;

      // Trigger state updates when session identity, source freshness, or exploration identity changes.
      const currentExplorations = dataRef.current.explorations;
      const newDataChanged = shouldUpdateSessionData(
        {
          sessionPath: dataRef.current.sessionPath,
          sessionId: dataRef.current.sessionId,
          sourceMtimeMs: dataRef.current.sourceMtimeMs,
          explorations: currentExplorations,
        },
        snapshot,
      );

      if (newDataChanged) {
        setData({
          sessionPath: snapshot.sessionPath,
          sessionId: snapshot.sessionId,
          sourceMtimeMs: snapshot.sourceMtimeMs,
          explorations: snapshot.explorations,
          tree: snapshot.tree,
          tokenDisplay: snapshot.tokenDisplay,
          runtimeModel: snapshot.runtimeModel,
        });
      }
    } catch (error) {
      // Silently ignore polling errors (e.g., session file not yet created)
      reportError('io', 'observer polling failed', {
        cwd,
        explicitSessionId: boundSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pollingRef.current = false;
    }
  }, [bindingIntent, boundSessionId, cwd]);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [tick]);

  return {
    ...data,
    bindingIntent,
  };
}

export function shouldUpdateSessionData(
  prev: SessionIdentitySnapshot,
  next: SessionIdentitySnapshot,
): boolean {
  if (prev.sessionPath !== next.sessionPath || prev.sessionId !== next.sessionId) {
    return true;
  }
  if (prev.sourceMtimeMs !== next.sourceMtimeMs) {
    return true;
  }
  return !idsAndStatusMatch(prev.explorations, next.explorations);
}
