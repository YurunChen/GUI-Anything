/**
 * Single display path for exploration summaries (Apple: calm, no technical errors in UI).
 */

import type { Exploration, SessionScopedId, SummaryItem } from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';
import type { FlowchartHint } from '../../data/protocol/observer-protocol';
import {
  SUMMARY_REASON_LIVE_PREVIEW,
  SUMMARY_REASON_TIMELINE_EXCERPT,
} from '../../data/protocol/summary-provenance';
import type { WikiPersistMeta } from '../wiki/auto-extractor';
import { buildExplorationExcerptSummary } from './exploration-excerpt';
import { buildExplorationRoundRecord } from './exploration-round-record';
import {
  buildGreetingFlowchartHint,
  isTrivialGreetingExploration,
  type ExplorationSummaryAIResult,
} from './flow-summaries';
import { getSummaryMessages } from '../../constants/summary-messages';

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
  const m = getSummaryMessages();
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

function toSummaryNodes(nodes: Exploration['nodes']) {
  return nodes.map((node) => ({
    timestamp: node.timestamp,
    type: node.type,
    label: node.label,
    status: node.status,
  }));
}

export function buildLiveSummaryPreview(exploration: Exploration): string {
  const nodes = toSummaryNodes(exploration.nodes);
  if (isTrivialGreetingExploration(exploration.question, nodes)) {
    return getSummaryMessages().trivialGreetingDistill;
  }
  return buildExplorationRoundRecord(exploration.question, nodes);
}

export function buildLiveSummaryPreviewFlowchart(exploration: Exploration): FlowchartHint | undefined {
  const nodes = toSummaryNodes(exploration.nodes);
  if (isTrivialGreetingExploration(exploration.question, nodes)) {
    return buildGreetingFlowchartHint();
  }
  return undefined;
}

/** Live: show rule-based Hero until Summary Agent returns. */
export function applyLiveSummaryPreview(input: {
  sessionId: string;
  explorations: Exploration[];
  items: Record<SessionScopedId, SummaryItem>;
  hasBundleSummaryByExplorationId?: Record<string, boolean>;
}): Record<SessionScopedId, SummaryItem> {
  if (!input.sessionId.trim()) return input.items;

  const next = { ...input.items };
  for (const exploration of input.explorations) {
    if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
    const id = makeSessionScopedId(input.sessionId, exploration.id);
    if (input.hasBundleSummaryByExplorationId?.[exploration.id]) continue;
    if (next[id]?.text.trim()) continue;

    const text = buildLiveSummaryPreview(exploration);
    const previewFlowchart = buildLiveSummaryPreviewFlowchart(exploration);
    next[id] = {
      id,
      sessionId: input.sessionId,
      explorationId: exploration.id,
      text,
      source: 'excerpt',
      status: 'ready',
      persistMeta: next[id]?.persistMeta ?? null,
      flowchart: next[id]?.flowchart ?? previewFlowchart,
      reason: SUMMARY_REASON_LIVE_PREVIEW,
    };
  }
  return next;
}

/** Replay: add rule-based excerpt for complete explorations without any summary text. */
export function applyExcerptFallback(input: {
  sessionId: string;
  explorations: Exploration[];
  items: Record<SessionScopedId, SummaryItem>;
}): Record<SessionScopedId, SummaryItem> {
  if (!input.sessionId.trim()) return input.items;

  const next = { ...input.items };
  for (const exploration of input.explorations) {
    if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
    const id = makeSessionScopedId(input.sessionId, exploration.id);
    const existing = next[id];
    if (existing?.text.trim()) continue;

    const text = buildExplorationExcerptSummary(exploration.question, exploration.nodes);
    next[id] = {
      id,
      sessionId: input.sessionId,
      explorationId: exploration.id,
      text,
      source: 'fallback',
      status: 'ready',
      persistMeta: existing?.persistMeta ?? null,
      flowchart: existing?.flowchart,
      reason: SUMMARY_REASON_TIMELINE_EXCERPT,
    };
  }
  return next;
}
