/**
 * useSessionPolling - application adapter for observer session polling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActivityTree } from '../../../domain/types';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import { PollingObserverSessionService } from '../../../services/session/observer-session-service';

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

  // Debug: log environment
  useEffect(() => {
    console.error('[useSessionPolling] Debug:', {
      cwd,
      explicitSessionId,
      FLOW_PROJECT_DIR: process.env.FLOW_PROJECT_DIR,
      FLOW_SESSION_ID: process.env.FLOW_SESSION_ID,
      HOME: process.env.HOME,
    });
  }, []);

  const sessionServiceRef = useRef<PollingObserverSessionService | null>(null);
  if (!sessionServiceRef.current) {
    sessionServiceRef.current = new PollingObserverSessionService();
  }

  const tick = useCallback(async () => {
    try {
      console.error('[useSessionPolling] Polling with:', { cwd, explicitSessionId });
      const snapshot = await sessionServiceRef.current!.poll({ cwd, explicitSessionId });
      console.error('[useSessionPolling] Got snapshot:', snapshot ? 'yes' : 'no');
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
      console.error('[useSessionPolling] Poll error:', error);
    }
  }, [cwd, explicitSessionId]);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [tick]);

  return data;
}
