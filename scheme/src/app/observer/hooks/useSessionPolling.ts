/**
 * useSessionPolling - application adapter for observer session polling.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ActivityTree } from '../../../domain/types';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import { getSessionIndexService } from '../../../services/session/session-index-service';
import { PollingObserverSessionService } from '../../../services/session/observer-session-service';
import {
  resolveSessionBindingIntent,
} from '../../../services/session/session-binding-policy';
import { createLogger } from '../../../utils/logger';
import { reportError } from '../../../utils/observability';

const log = createLogger('observer');

interface SessionData {
  sessionPath: string;
  sessionId: string;
  sourceMtimeMs: number;
  explorations: Exploration[];
  tree: ActivityTree | null;
  tokenDisplay: string;
  runtimeModel: string;
  awaitingPickerSelection: boolean;
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

  const [data, setData] = useState<SessionData>({
    sessionPath: '',
    sessionId: bindingIntent.explicitSessionId || '',
    sourceMtimeMs: 0,
    explorations: [],
    tree: null,
    tokenDisplay: 'Tok --',
    runtimeModel: 'unknown',
    awaitingPickerSelection: bindingIntent.mode === 'continue_picker',
  });

  const sessionServiceRef = useRef<PollingObserverSessionService | null>(null);
  if (!sessionServiceRef.current) {
    sessionServiceRef.current = new PollingObserverSessionService();
  }
  const manifestWrittenRef = useRef(false);
  const bindingKeyRef = useRef('');
  const bindingKey = `${bindingIntent.mode}:${bindingIntent.explicitSessionId || ''}`;
  if (bindingKeyRef.current !== bindingKey) {
    bindingKeyRef.current = bindingKey;
    sessionServiceRef.current.resetForBindingChange();
    manifestWrittenRef.current = false;
  }
  const pollingRef = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const lastLoggedExplorationKeyRef = useRef('');

  const tick = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const snapshot = await sessionServiceRef.current!.poll({
        cwd,
        bindingMode: bindingIntent.mode,
        explicitSessionId: bindingIntent.explicitSessionId,
      });
      if (!snapshot) {
        if (bindingIntent.mode === 'continue_picker' || bindingIntent.explicitSessionId) {
          setData((prev) => ({
            ...prev,
            sessionPath: '',
            sessionId: bindingIntent.explicitSessionId || prev.sessionId,
            sourceMtimeMs: 0,
            explorations: [],
            tree: null,
            awaitingPickerSelection: bindingIntent.mode === 'continue_picker'
              && sessionServiceRef.current!.isAwaitingPickerSelection(),
          }));
        }
        return;
      }

      if (snapshot.sessionId && !manifestWrittenRef.current) {
        try {
          getSessionIndexService().touchLastSession({
            sessionId: snapshot.sessionId,
            cwd,
            jsonlMtime: snapshot.sourceMtimeMs,
          });
          manifestWrittenRef.current = true;
          log.debug('session index touched', {
            sessionId: snapshot.sessionId,
            jsonlMtime: snapshot.sourceMtimeMs,
          });
        } catch (error) {
          reportError('io', 'failed to write session index', {
            sessionId: snapshot.sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

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

      const awaitingPickerSelection = bindingIntent.mode === 'continue_picker'
        && sessionServiceRef.current!.isAwaitingPickerSelection()
        && !dataRef.current.sessionPath;

      if (newDataChanged || awaitingPickerSelection !== dataRef.current.awaitingPickerSelection) {
        const prevSnap = dataRef.current;
        const explorationKey = snapshot.explorations
          .map((e) => `${e.id}:${e.status}`)
          .join(',');
        const identityChanged = prevSnap.sessionPath !== snapshot.sessionPath
          || prevSnap.sessionId !== snapshot.sessionId
          || prevSnap.sourceMtimeMs !== snapshot.sourceMtimeMs;
        if (identityChanged && explorationKey === lastLoggedExplorationKeyRef.current) {
          log.debug('jsonl updated', {
            sessionId: snapshot.sessionId,
            mtime: snapshot.sourceMtimeMs,
          });
        } else if (identityChanged) {
          log.info('session bound', {
            sessionId: snapshot.sessionId,
            mtime: snapshot.sourceMtimeMs,
            explorations: snapshot.explorations.length,
          });
          lastLoggedExplorationKeyRef.current = explorationKey;
        } else if (explorationKey !== lastLoggedExplorationKeyRef.current) {
          log.info('explorations changed', {
            sessionId: snapshot.sessionId,
            explorations: snapshot.explorations.length,
            snapshot: explorationKey,
          });
          lastLoggedExplorationKeyRef.current = explorationKey;
        }
        setData({
          sessionPath: snapshot.sessionPath,
          sessionId: snapshot.sessionId,
          sourceMtimeMs: snapshot.sourceMtimeMs,
          explorations: snapshot.explorations,
          tree: snapshot.tree,
          tokenDisplay: snapshot.tokenDisplay,
          runtimeModel: snapshot.runtimeModel,
          awaitingPickerSelection,
        });
      }
    } catch (error) {
      reportError('io', 'observer polling failed', {
        cwd,
        mode: bindingIntent.mode,
        explicitSessionId: bindingIntent.explicitSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pollingRef.current = false;
    }
  }, [bindingIntent, cwd]);

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
