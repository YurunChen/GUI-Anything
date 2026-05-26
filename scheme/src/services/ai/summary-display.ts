/**
 * Single display path for exploration summaries (Apple: calm, no technical errors in UI).
 */

import type { Exploration, SummaryItem } from '../../data/protocol/observer-protocol';
import type { FlowchartHint } from '../../data/protocol/observer-protocol';
import type { WikiPersistMeta } from '../wiki/auto-extractor';
import { buildExplorationRoundRecord } from './exploration-round-record';
import type { ExplorationSummaryAIResult } from './flow-summaries';
import { getObserverMessages } from '../../app/ui/i18n/observer-messages';

export const DEFAULT_SKIP_PERSIST: WikiPersistMeta = {
  should_persist: false,
  type: 'none',
  confidence: 0.5,
  reason: 'skip',
};

export interface FinalizedSummaryFields {
  text: string;
  source: SummaryItem['source'];
  status: SummaryItem['status'];
  persistMeta: WikiPersistMeta | null;
  flowchart?: FlowchartHint;
  reason?: string;
}

/** Rule-based fallback summary when LLM generation is unavailable. */
function buildFallbackSummary(question: string, nodes: Exploration['nodes']): string {
  const m = getObserverMessages();
  if (nodes.filter((n) => n.type === 'tool').length === 0 && nodes.length === 0) {
    return m.calmNoSummary;
  }
  return buildExplorationRoundRecord(question, nodes);
}

export function finalizeExplorationSummaryItem(input: {
  question: string;
  nodes: Exploration['nodes'];
  payload: ExplorationSummaryAIResult & { validationError?: string };
}): FinalizedSummaryFields {
  const validationReason = input.payload.validationError
    ? String(input.payload.validationError)
    : undefined;

  if (!validationReason && input.payload.displaySummary?.trim()) {
    return {
      text: input.payload.displaySummary.trim(),
      source: 'ai',
      status: 'ready',
      persistMeta: input.payload.persist,
      flowchart: input.payload.flowchart,
    };
  }

  const text = input.payload.displaySummary?.trim()
    || buildFallbackSummary(input.question, input.nodes);

  return {
    text,
    source: 'fallback',
    status: 'ready',
    persistMeta: input.payload.persist ?? DEFAULT_SKIP_PERSIST,
    flowchart: input.payload.flowchart,
    reason: validationReason ? `structured_output_${validationReason}` : 'structured_output_fallback',
  };
}

/** After retries exhausted — still show timeline text, not an error card. */
export function finalizeSummaryFromTimelineOnly(input: {
  question: string;
  nodes: Exploration['nodes'];
  errorReason: string;
}): FinalizedSummaryFields {
  return {
    text: buildFallbackSummary(input.question, input.nodes),
    source: 'fallback',
    status: 'ready',
    persistMeta: DEFAULT_SKIP_PERSIST,
    reason: input.errorReason,
  };
}
