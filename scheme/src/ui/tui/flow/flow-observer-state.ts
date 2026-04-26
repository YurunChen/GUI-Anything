/**
 * Flow Observer State Machine
 * 
 * Explicit state types to replace scattered useEffect logic.
 * States are derived from data, not stored independently.
 */

import type { Exploration } from '../../../runtime/posthoc';

// Session discovery state
export type SessionState = 
  | { type: 'missing' }           // No session file found yet
  | { type: 'loading' }           // File exists but no data yet
  | { type: 'live'; path: string; id: string };  // Active session

// Exploration lifecycle state
export type ExplorationState = 
  | { type: 'running' }           // Currently in progress
  | { type: 'summarizing' }       // Complete but summary pending
  | { type: 'complete' }          // Has summary, no persist action yet
  | { type: 'persist_pending' }   // Persist check in progress
  | { type: 'persisted_skipped' } // Model signaled should_persist=false
  | { type: 'persisted_saved' }   // Successfully written to Wiki
  | { type: 'persist_failed' };  // Write failed

// Context panel tabs (only inspiration retained)
export type ContextTab = 'inspiration' | null;

// Direction generation state
export type DirectionsState =
  | { type: 'idle' }
  | { type: 'insufficient'; reason: string }
  | { type: 'generating' }
  | { type: 'ready' }
  | { type: 'error'; message: string };

// Wiki match state (search results)
export type WikiSearchState =
  | { type: 'idle' }
  | { type: 'searching' }
  | { type: 'found'; matchId: string; confidence: number }
  | { type: 'none' };

// State derivation functions (pure, no side effects)

export function deriveSessionState(
  sessionPath: string | null,
  hasExplorations: boolean
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
    id: sessionPath.split('/').pop()?.replace('.jsonl', '') || 'unknown'
  };
}

export function deriveExplorationState(
  exploration: Exploration,
  summary: string | undefined,
  persistStatus: 'saved' | 'skipped' | 'failed' | 'pending' | undefined
): ExplorationState {
  if (exploration.status === 'running') {
    return { type: 'running' };
  }
  
  if (exploration.status === 'complete') {
    if (!summary) {
      return { type: 'summarizing' };
    }
    
    switch (persistStatus) {
      case 'pending':
        return { type: 'persist_pending' };
      case 'skipped':
        return { type: 'persisted_skipped' };
      case 'saved':
        return { type: 'persisted_saved' };
      case 'failed':
        return { type: 'persist_failed' };
      default:
        return { type: 'complete' };
    }
  }
  
  // interrupted or other
  return { type: 'complete' };
}

// UI-friendly status text
export function getExplorationStatusText(state: ExplorationState): string {
  switch (state.type) {
    case 'running': return '●';
    case 'summarizing': return '⋯';
    case 'complete': return '○';
    case 'persist_pending': return '⧗';
    case 'persisted_saved': return '✓';
    case 'persisted_skipped': return '−';
    case 'persist_failed': return '✗';
    default: return '?';
  }
}

export function getExplorationStatusColor(state: ExplorationState): string {
  switch (state.type) {
    case 'running': return '#4EC9B0'; // teal
    case 'summarizing': return '#DCDCAA'; // yellow
    case 'persist_pending': return '#DCDCAA';
    case 'complete': return '#6A9955'; // green
    case 'persisted_saved': return '#6A9955';
    case 'persisted_skipped': return '#858585'; // gray
    case 'persist_failed': return '#F44747'; // red
    default: return '#858585';
  }
}
