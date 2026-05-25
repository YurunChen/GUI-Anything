/**
 * Summary data contract — single shape from cache → service → app → wiki persist.
 */

import {
  makeSessionScopedId,
  type ExplorationId,
  type FlowchartHint,
  type SessionId,
  type SessionScopedId,
  type SummaryItem,
} from './observer-protocol';

/** Lookup by exploration id (preferred over scanning Object.values). */
export function getSummaryItemForExploration(
  items: Record<SessionScopedId, SummaryItem> | undefined,
  explorationId: ExplorationId,
): SummaryItem | undefined {
  if (!items) return undefined;
  for (const item of Object.values(items)) {
    if (item.explorationId === explorationId) return item;
  }
  return undefined;
}

export function indexSummaryItemsByExploration(
  items: Record<SessionScopedId, SummaryItem>,
): Record<ExplorationId, SummaryItem> {
  const out: Record<ExplorationId, SummaryItem> = {};
  for (const item of Object.values(items)) {
    out[item.explorationId] = item;
  }
  return out;
}

/** @deprecated Prefer indexSummaryItemsByExploration */
export const indexSummaryItemsByExplorationId = indexSummaryItemsByExploration;

export function toExplorationSummaryTextMap(
  items: Record<SessionScopedId, SummaryItem>,
): Record<ExplorationId, string> {
  const out: Record<ExplorationId, string> = {};
  for (const item of Object.values(items)) {
    out[item.explorationId] = item.text;
  }
  return out;
}

export function toExplorationPersistMetaMap(
  items: Record<SessionScopedId, SummaryItem>,
): Record<ExplorationId, SummaryItem['persistMeta']> {
  const out: Record<ExplorationId, SummaryItem['persistMeta']> = {};
  for (const item of Object.values(items)) {
    out[item.explorationId] = item.persistMeta;
  }
  return out;
}

export function toExplorationFlowchartHintMap(
  items: Record<SessionScopedId, SummaryItem>,
): Record<ExplorationId, FlowchartHint> {
  const out: Record<ExplorationId, FlowchartHint> = {};
  for (const item of Object.values(items)) {
    if (!item.flowchart) continue;
    out[item.explorationId] = item.flowchart;
  }
  return out;
}

/** Ensure session-scoped ids match sessionId + explorationId (repair legacy merges). */
export function normalizeSummaryItems(
  sessionId: SessionId,
  items: Record<SessionScopedId, SummaryItem>,
): Record<SessionScopedId, SummaryItem> {
  const out: Record<SessionScopedId, SummaryItem> = {};
  for (const item of Object.values(items)) {
    const explorationId = item.explorationId;
    const id = makeSessionScopedId(sessionId, explorationId);
    out[id] = {
      ...item,
      id,
      sessionId,
      explorationId,
    };
  }
  return out;
}
