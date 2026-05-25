import type {
  ExplorationId,
  FlowchartHint,
  SessionIntentState,
  TitleDelta,
} from '../../data/protocol/observer-protocol';

const HISTORY_CAP = 8;

export interface IntentTitleMergeInput {
  explorationId: ExplorationId;
  hint: FlowchartHint;
  titleDelta?: TitleDelta;
  titleDeltaNote?: string;
  at?: number;
}

import { isGreetingFlowchart } from '../../data/protocol/flowchart-intent';

export { isGreetingFlowchart } from '../../data/protocol/flowchart-intent';

/** Session intent merge: first real task after greeting is treated as pivot. */
export function resolveTitleDelta(
  prior: SessionIntentState | null,
  hint: FlowchartHint,
  explicit?: TitleDelta,
): TitleDelta {
  const raw = explicit ?? hint.titleDelta ?? inferTitleDelta(prior, hint);
  if (raw === 'idle' || raw === 'blocked' || raw === 'done') return raw;
  const leavingGreeting = prior && (prior.phase === 'idle' || prior.intentKey === 'greeting');
  if (leavingGreeting && !isGreetingFlowchart(hint)) return 'pivot';
  return raw;
}

export function mergeIntentTitleState(
  prior: SessionIntentState | null,
  sessionId: string,
  input: IntentTitleMergeInput,
): SessionIntentState {
  const delta = resolveTitleDelta(prior, input.hint, input.titleDelta);
  const note = input.titleDeltaNote ?? input.hint.titleDeltaNote;
  const at = input.at ?? Date.now();
  const revision = (prior?.revision ?? 0) + 1;

  let intentKey = input.hint.intentKey;
  let nodeTitle = input.hint.nodeTitle;
  let parentIntentKey: string | null = input.hint.parentId
    ? resolveParentIntentKey(prior, input.hint.parentId)
    : null;
  let phase: SessionIntentState['phase'] = 'active';

  if (delta === 'idle') {
    phase = 'idle';
    intentKey = input.hint.intentKey || 'greeting';
    nodeTitle = input.hint.nodeTitle;
    parentIntentKey = null;
  } else if (delta === 'pivot') {
    parentIntentKey = prior?.intentKey ?? parentIntentKey;
    phase = 'active';
  } else if (delta === 'blocked') {
    phase = 'blocked';
  } else if (delta === 'done') {
    phase = 'done';
  } else if (delta === 'refine') {
    if (prior?.intentKey && intentKey === prior.intentKey) {
      nodeTitle = input.hint.nodeTitle;
    }
    phase = 'active';
  } else {
    if (prior && intentKey === prior.intentKey) {
      nodeTitle = input.hint.nodeTitle || prior.nodeTitle;
    }
    phase = 'active';
  }

  const historyEntry = {
    explorationId: input.explorationId,
    at,
    intentKey,
    nodeTitle,
    titleDelta: delta,
    titleDeltaNote: note,
  };

  const history = [...(prior?.history ?? []), historyEntry].slice(-HISTORY_CAP);

  return {
    sessionId,
    revision,
    intentKey,
    nodeTitle,
    parentIntentKey,
    phase,
    history,
    updatedAt: at,
  };
}

function inferTitleDelta(prior: SessionIntentState | null, hint: FlowchartHint): TitleDelta {
  if (hint.titleDelta) return hint.titleDelta;
  if (!prior) return 'pivot';
  if (hint.intentKey !== prior.intentKey) return 'pivot';
  if (hint.nodeTitle.trim() !== prior.nodeTitle.trim()) return 'refine';
  return 'continue';
}

function resolveParentIntentKey(
  prior: SessionIntentState | null,
  parentId: string,
): string | null {
  if (!prior) return null;
  const fromHistory = [...prior.history].reverse().find((h) => h.intentKey === parentId);
  if (fromHistory) return fromHistory.intentKey;
  if (prior.intentKey === parentId) return prior.intentKey;
  return parentId;
}

export function bootstrapIntentStateFromHints(
  sessionId: string,
  hints: Array<{ explorationId: ExplorationId; hint: FlowchartHint; at: number }>,
): SessionIntentState | null {
  if (hints.length === 0) return null;
  const ordered = [...hints].sort((a, b) => a.at - b.at);
  let state: SessionIntentState | null = null;
  for (const item of ordered) {
    state = mergeIntentTitleState(state, sessionId, {
      explorationId: item.explorationId,
      hint: item.hint,
      at: item.at,
    });
  }
  return state;
}
