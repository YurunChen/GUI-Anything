/**
 * Session runtime — single derivation chain for observer phase, visibility, and agents.
 *
 * ```text
 * flow-run (FLOW_RESUME_MODE) → binding intent → jsonl bind → bundle hydrate
 *   → hasMissingSummaries → phase (live|replay) → UI + summary agent + wiki search
 * ```
 */

import type {
  Exploration,
  SessionScopedId,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';
import type { SessionBindingIntent } from './session-binding-policy';
import { isContinueMode } from './session-binding-policy';

export type SessionObserverPhase = 'live' | 'replay';

/** @deprecated alias — UI chrome uses the same live/replay values */
export type SessionPresentationMode = SessionObserverPhase;

export type SessionDataReadyState = 'none' | 'exploration_ready' | 'flowchart_ready';
export type SessionVisibilityState = 'show' | 'hide';

export interface SessionPresentationPolicy {
  mode: SessionObserverPhase;
  allowSummaryRegen: boolean;
  allowWikiLiveSearch: boolean;
  fillExcerptFallback: boolean;
}

export interface SessionRuntimeContext {
  intent: SessionBindingIntent;
  sessionId: string;
  sessionBound: boolean;
  explorations: Exploration[];
  /** Hydrated bundle items (before live preview / excerpt display layers). */
  summaryItems: Record<SessionScopedId, SummaryItem>;
  wikiBundleHasData: boolean;
  explorationCount: number;
  summaryCount: number;
  flowchartHintCount: number;
  graphCacheHit?: boolean;
}

export interface SessionRuntime {
  phase: SessionObserverPhase;
  presentation: SessionPresentationPolicy;
  visibility: SessionVisibilityState;
  dataReady: SessionDataReadyState;
  hasMissingSummaries: boolean;
}

export function hasMissingSummaries(
  sessionId: string,
  explorations: Exploration[],
  items: Record<SessionScopedId, SummaryItem>,
): boolean {
  return countMissingSummaries(sessionId, explorations, items) > 0;
}

export function countMissingSummaries(
  sessionId: string,
  explorations: Exploration[],
  items: Record<SessionScopedId, SummaryItem>,
): number {
  const sid = sessionId.trim();
  if (!sid) return 0;
  let count = 0;
  for (const exploration of explorations) {
    if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
    const id = makeSessionScopedId(sid, exploration.id);
    const item = items[id];
    if (item?.status === 'ready' && item.text?.trim()) continue;
    count += 1;
  }
  return count;
}

/** Continue + full wiki coverage → replay; otherwise live (incl. gap-fill). */
export function resolveObserverPhase(
  intent: SessionBindingIntent,
  wikiBundleHasData: boolean,
  missingSummaries: boolean,
): SessionObserverPhase {
  if (isContinueMode(intent.mode) && wikiBundleHasData && !missingSummaries) {
    return 'replay';
  }
  return 'live';
}

export function presentationFromPhase(phase: SessionObserverPhase): SessionPresentationPolicy {
  const replay = phase === 'replay';
  return {
    mode: phase,
    allowSummaryRegen: !replay,
    allowWikiLiveSearch: !replay,
    fillExcerptFallback: replay,
  };
}

export function deriveSessionRuntime(ctx: SessionRuntimeContext): SessionRuntime {
  const missing = hasMissingSummaries(ctx.sessionId, ctx.explorations, ctx.summaryItems);
  const phase = resolveObserverPhase(ctx.intent, ctx.wikiBundleHasData, missing);
  const presentation = presentationFromPhase(phase);
  const awaitingPicker = ctx.intent.mode === 'continue_picker' && !ctx.sessionBound;

  return {
    phase,
    presentation,
    visibility: awaitingPicker ? 'hide' : 'show',
    dataReady: deriveDataReadyState(ctx),
    hasMissingSummaries: missing,
  };
}

function deriveDataReadyState(ctx: SessionRuntimeContext): SessionDataReadyState {
  if (ctx.explorationCount <= 0) {
    return 'none';
  }
  if (ctx.summaryCount <= 0 && ctx.flowchartHintCount <= 0) {
    return 'exploration_ready';
  }
  return 'flowchart_ready';
}
