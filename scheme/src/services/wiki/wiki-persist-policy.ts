/**
 * Wiki persist gate — intent-bucket accumulate + curate on pivot / session sweep.
 */

import type {
  Exploration,
  IntentBucket,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import { resolveTitleDelta } from '../ai/intent-title-merge';
import type { SessionIntentState } from '../../data/protocol/observer-protocol';

export type WikiPersistPhase = 'wait' | 'accumulate' | 'curate_intent' | 'done';

export type WikiPersistStatus = 'saved' | 'updated' | 'skipped' | 'failed' | 'pending';

/** Terminal for this session — do not re-run Wiki Agent. `failed` is retryable. */
export function isWikiPersistSettled(status?: WikiPersistStatus): boolean {
  return status === 'saved'
    || status === 'updated'
    || status === 'skipped'
    || status === 'pending';
}

export function isSummaryReadyForWiki(item?: SummaryItem): boolean {
  return Boolean(item?.text?.trim() && item.status === 'ready' && item.source !== 'excerpt');
}

export function isPivotCloseEvent(
  priorIntent: SessionIntentState | null,
  hint: NonNullable<SummaryItem['flowchart']>,
): boolean {
  const delta = resolveTitleDelta(priorIntent, hint);
  if (delta !== 'pivot') return false;
  if (!priorIntent || priorIntent.phase === 'idle' || priorIntent.intentKey === 'greeting') {
    return false;
  }
  return priorIntent.intentKey !== hint.intentKey || delta === 'pivot';
}

/** @deprecated Legacy per-exploration phase — use intent curator unless FLOW_WIKI_LEGACY_PER_TURN=1 */
export type LegacyWikiPersistPhase = 'wait' | 'run_agent' | 'done';

export function resolveWikiPersistPhase(input: {
  exploration: Exploration;
  summaryItem?: SummaryItem;
  persistStatus?: WikiPersistStatus;
}): LegacyWikiPersistPhase {
  if (input.exploration.status !== 'complete') return 'wait';
  if (isWikiPersistSettled(input.persistStatus)) return 'done';
  if (!isSummaryReadyForWiki(input.summaryItem)) return 'wait';
  return 'run_agent';
}

export function resolveIntentWikiPhase(input: {
  exploration: Exploration;
  summaryItem?: SummaryItem;
  bucket?: IntentBucket | null;
  isPivotClose?: boolean;
  inFlightIntentKey?: string | null;
}): WikiPersistPhase {
  if (input.exploration.status !== 'complete') return 'wait';
  if (!isSummaryReadyForWiki(input.summaryItem)) return 'wait';

  if (input.bucket?.curatedAt) return 'done';

  if (input.isPivotClose || input.inFlightIntentKey) {
    return 'curate_intent';
  }

  return 'accumulate';
}

export function shouldCurateOpenBucket(bucket: IntentBucket | null | undefined): boolean {
  if (!bucket || bucket.curatedAt) return false;
  return bucket.explorationIds.length > 0;
}
