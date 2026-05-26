import { useMemo } from 'react';
import type { SessionIntentState } from '../../../data/protocol/observer-protocol';
import { getSessionBundleService } from '../../../services/session/session-bundle-service';

/** Session intent title from bundle — refreshes when refreshKey changes (e.g. after summary updates). */
export function useSessionIntent(
  sessionId: string,
  refreshKey?: unknown,
): SessionIntentState | null {
  return useMemo(() => {
    if (!sessionId.trim()) return null;
    return getSessionBundleService().getSessionIntent(sessionId);
  }, [sessionId, refreshKey]);
}
