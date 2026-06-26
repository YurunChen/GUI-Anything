import { flowSpacing } from '../flow-ui/flow-spacing';
export type { GraphNodeChromeParts } from '../../../observer/view-model/flow-graph-node-display';
export { resolveGraphNodeChromeParts } from '../../../observer/view-model/flow-graph-node-display';

/** Left indent fallback when connector prefix is empty (multi-root spacing). */
export function resolveRailRowIndent(depth: number): number {
  return Math.max(0, depth) * flowSpacing.graphRailIndent;
}

/** Vertical + arrow connector between stacked node cards. */
export function formatStackConnector(trunk: string, down: string): string {
  return `${trunk}\n${down}`;
}
