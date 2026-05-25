import type { Exploration } from '../data/protocol/observer-protocol';

export interface ExplorationMetrics {
  toolCount: number;
  errorCount: number;
}

/** Count tool nodes and error nodes in an exploration's node list. */
export function extractExplorationMetrics(
  nodes: Exploration['nodes'],
): ExplorationMetrics {
  return {
    toolCount: nodes.filter((n) => n.type === 'tool').length,
    errorCount: nodes.filter((n) => n.type === 'error' || n.status === 'error').length,
  };
}
