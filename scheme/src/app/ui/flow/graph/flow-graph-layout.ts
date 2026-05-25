import { lineDisplayWidth } from '../../../../utils/flow-text';
import type { TreeDataNode } from './TreeView';
import type { TreeRow } from './TreeView';

export type FlowGraphLayoutMode = 'rail' | 'stack' | 'grid';

/** Horizontal gap between sibling node cards in grid layout. */
export const GRAPH_LEVEL_GAP = 2;

/** Border + horizontal padding around a node card. */
export const GRAPH_CARD_CHROME = 4;

export function isLinearChain<T>(levels: TreeDataNode<T>[][]): boolean {
  return levels.length > 0 && levels.every((level) => level.length === 1);
}

export function maxLevelWidth<T>(levels: TreeDataNode<T>[][]): number {
  return levels.reduce((max, level) => Math.max(max, level.length), 0);
}

/** Pick layout: rail (narrow tree), stack (linear full-width), grid (branching cards). */
export function resolveFlowGraphLayoutMode<T>(
  availableWidth: number,
  levels: TreeDataNode<T>[][],
): FlowGraphLayoutMode {
  if (levels.length === 0) return 'stack';
  if (availableWidth < 72) return 'rail';
  if (isLinearChain(levels)) return 'stack';
  if (availableWidth < 100 && maxLevelWidth(levels) <= 2) return 'stack';
  return 'grid';
}

/** Inner text width for a node card at this level. */
export function resolveCardInnerWidth(availableWidth: number, nodesInLevel: number): number {
  const chrome = 4;
  if (nodesInLevel <= 1) {
    return Math.max(12, availableWidth - chrome);
  }
  const gap = 2;
  const usable = availableWidth - gap * Math.max(0, nodesInLevel - 1);
  return Math.max(10, Math.floor(usable / nodesInLevel) - chrome);
}

export function shouldTruncateNodeLabel(cardInnerWidth: number): boolean {
  return cardInnerWidth < 20;
}

export function resolveNodeCardOuterWidth(cardInnerWidth: number): number {
  return cardInnerWidth + GRAPH_CARD_CHROME;
}

/** Stack cards use full pane width (no narrow column cap). */
export function resolveStackCardInnerWidth(availableWidth: number): number {
  return resolveCardInnerWidth(availableWidth, 1);
}

export function measureGridLevelOuterWidth(availableWidth: number, nodesInLevel: number): number {
  if (nodesInLevel <= 0) return 0;
  const inner = resolveCardInnerWidth(availableWidth, nodesInLevel);
  const slot = resolveNodeCardOuterWidth(inner);
  return nodesInLevel * slot + GRAPH_LEVEL_GAP * Math.max(0, nodesInLevel - 1);
}

export function resolveCenterPadding(availableWidth: number, contentWidth: number): number {
  const inset = Math.floor((availableWidth - contentWidth) / 2);
  return Math.max(0, inset);
}

export function measureRailContentWidth<T>(
  rows: TreeRow<T>[],
  labelForRow: (row: TreeRow<T>) => string,
): number {
  let max = 0;
  for (const row of rows) {
    const line = `${row.connectorPrefix || ''}${labelForRow(row)}`;
    max = Math.max(max, lineDisplayWidth(line));
  }
  return max;
}
