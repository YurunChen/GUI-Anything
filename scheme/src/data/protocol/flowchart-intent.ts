/**
 * Single source for reading flowchart intent chrome (catalog key + title).
 * Graph structure slugs (node_id) stay separate from session intent vocabulary.
 */

import { normalizeSessionIntentKey, SESSION_INTENT_GREETING } from '../../constants/session-intent-keys';
import type { Exploration, FlowchartHint, SummaryItem } from './observer-protocol';

/** Greeting / idle flowchart — not a real session task intent. */
export function isGreetingFlowchart(hint: FlowchartHint | null | undefined): boolean {
  if (!hint) return false;
  return hint.dropFromChart === true
    || hint.titleDelta === 'idle'
    || hint.intentKey === SESSION_INTENT_GREETING
    || catalogIntentKey(hint.intentKey) === SESSION_INTENT_GREETING;
}

/** Session intent vocabulary key — badges, wiki gates, status bar, graph node intentKey. */
export function catalogIntentKey(raw: string | undefined | null): string {
  return normalizeSessionIntentKey(raw?.trim() ?? '');
}

export function catalogIntentKeyFromHint(hint?: FlowchartHint | null): string {
  return catalogIntentKey(hint?.intentKey);
}

/** Slug for flowchart node_id (tree identity only — never intent_key). */
export function slugFlowchartNodeId(raw: string | undefined | null, fallbackExplorationId?: string): string {
  const trimmed = raw?.trim();
  if (trimmed) return slugIntentKey(trimmed);
  if (fallbackExplorationId) return slugIntentKey(`exp_${fallbackExplorationId}`);
  return 'intent';
}

export function slugIntentKey(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'intent';
}

export interface FlowchartChromeSource {
  intentKey: string;
  title: string;
}

/** Displayable flowchart row from a hint (null when greeting / no title). */
export function resolveFlowchartChromeFromHint(
  hint?: FlowchartHint | null,
): FlowchartChromeSource | undefined {
  const nodeTitle = hint?.nodeTitle?.trim();
  if (!nodeTitle || isGreetingFlowchart(hint)) return undefined;
  return {
    intentKey: catalogIntentKeyFromHint(hint),
    title: nodeTitle,
  };
}

const TERMINAL_EXPLORATION_STATUS = new Set<Exploration['status']>(['complete', 'interrupted']);

/** Latest completed exploration with displayable flowchart — status bar + live intent. */
export function resolveLatestFlowchartChrome(input: {
  explorations: Exploration[];
  itemsByExplorationId: Record<string, SummaryItem | undefined>;
}): FlowchartChromeSource | undefined {
  const ordered = sortExplorationsByTimeline(input.explorations);
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const exploration = ordered[i];
    if (!TERMINAL_EXPLORATION_STATUS.has(exploration.status)) continue;
    const chrome = resolveFlowchartChromeFromHint(input.itemsByExplorationId[exploration.id]?.flowchart);
    if (chrome) return chrome;
  }
  return undefined;
}

export function compareExplorationsByTimeline(a: Exploration, b: Exploration): number {
  const start = a.startedAt - b.startedAt;
  if (start !== 0) return start;
  const endA = a.endedAt ?? Number.MAX_SAFE_INTEGER;
  const endB = b.endedAt ?? Number.MAX_SAFE_INTEGER;
  const end = endA - endB;
  if (end !== 0) return end;
  return a.id.localeCompare(b.id);
}

/** Chronological exploration order — graph builder, intent chrome, timeline. */
export function sortExplorationsByTimeline(explorations: Exploration[]): Exploration[] {
  return [...explorations].sort(compareExplorationsByTimeline);
}
