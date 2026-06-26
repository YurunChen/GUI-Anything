import type { SessionIntentState } from './observer-protocol';

/** Reconstruct session intent immediately before a given exploration was merged. */
export function intentBeforeExploration(
  current: SessionIntentState | null,
  explorationId: string,
): SessionIntentState | null {
  if (!current) return null;
  const idx = current.history.findIndex((entry) => entry.explorationId === explorationId);
  if (idx <= 0) return null;

  const priorHistory = current.history.slice(0, idx);
  const last = priorHistory[priorHistory.length - 1];
  if (!last) return null;

  const parent = priorHistory.length >= 2
    ? priorHistory[priorHistory.length - 2].intentKey
    : null;

  return {
    sessionId: current.sessionId,
    revision: Math.max(0, current.revision - (current.history.length - idx)),
    intentKey: last.intentKey,
    nodeTitle: last.nodeTitle,
    parentIntentKey: parent,
    phase: last.titleDelta === 'idle' ? 'idle' : 'active',
    history: priorHistory,
    updatedAt: last.at,
  };
}
