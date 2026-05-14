/**
 * useSessionPolling - application adapter for observer session polling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActivityTree } from '../../../domain/types';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import { PollingObserverSessionService } from '../../../services/session/observer-session-service';
import { reportError } from '../../../utils/observability';

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

  const sessionServiceRef = useRef<PollingObserverSessionService | null>(null);
  if (!sessionServiceRef.current) {
    sessionServiceRef.current = new PollingObserverSessionService();
  }

  const tick = useCallback(async () => {
    try {
      const snapshot = await sessionServiceRef.current!.poll({ cwd, explicitSessionId });
      if (!snapshot) return;
      setData({
        sessionPath: snapshot.sessionPath,
        sessionId: snapshot.sessionId,
        explorations: snapshot.explorations,
        tree: snapshot.tree,
        tokenDisplay: snapshot.tokenDisplay,
        runtimeModel: snapshot.runtimeModel,
      });
    } catch (error) {
      // Silently ignore polling errors (e.g., session file not yet created)
      reportError('io', 'observer polling failed', {
        cwd,
        explicitSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [cwd, explicitSessionId]);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [tick]);

  return data;
}
