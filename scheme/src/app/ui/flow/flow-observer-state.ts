/**
 * Flow Observer State Machine
 *
 * Explicit state types to replace scattered useEffect logic.
 * States are derived from data, not stored independently.
 */

// Session discovery state
export type SessionState =
  | { type: 'missing' }           // No session file found yet
  | { type: 'loading' }           // File exists but no data yet
  | { type: 'live'; path: string; id: string };  // Active session

// Wiki match state (search results)
export type WikiSearchState =
  | { type: 'idle' }
  | { type: 'searching' }
  | { type: 'found'; matchId: string; confidence: number }
  | { type: 'none' };

// State derivation functions (pure, no side effects)

export function deriveSessionState(
  sessionPath: string | null,
  hasExplorations: boolean,
): SessionState {
  if (!sessionPath) {
    return { type: 'missing' };
  }
  if (!hasExplorations) {
    return { type: 'loading' };
  }
  return {
    type: 'live',
    path: sessionPath,
    id: sessionPath.split('/').pop()?.replace('.jsonl', '') || 'unknown',
  };
}
