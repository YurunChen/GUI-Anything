/**
 * Pure aggregation of per-exploration metrics into node / era / session / project
 * level `EvolutionMetrics`. Reliable-signals only (see docs/EVOLUTION_HTML_V2_DESIGN.md §2).
 */

import type {
  EvolutionMetrics,
  EvolutionNode,
  ExplorationMetricsRaw,
} from '../../data/protocol/evolution-types';

export function emptyMetrics(): EvolutionMetrics {
  return { toolCount: 0, errorCount: 0, retrievals: 0, writes: 0, interrupted: 0 };
}

/** Fold one exploration's raw metrics into an accumulator (mutates + returns it). */
export function accumulate(target: EvolutionMetrics, raw: ExplorationMetricsRaw | undefined): EvolutionMetrics {
  if (!raw) return target;
  target.toolCount += raw.toolCount;
  target.errorCount += raw.errorCount;
  target.retrievals += raw.retrieval ? 1 : 0;
  target.writes += raw.write ? 1 : 0;
  target.interrupted += raw.interrupted ? 1 : 0;
  if (typeof raw.tokens === 'number' && raw.tokens > 0) {
    target.tokens = (target.tokens ?? 0) + raw.tokens;
  }
  if (raw.files && raw.files.length) {
    const set = new Set(target.files ?? []);
    for (const f of raw.files) set.add(f);
    target.files = [...set];
  }
  return target;
}

/** Aggregate a set of explorationIds against a per-exp metrics map. */
export function aggregateExplorations(
  explorationIds: Iterable<string>,
  metricsByExp: Record<string, ExplorationMetricsRaw>,
): EvolutionMetrics {
  const out = emptyMetrics();
  for (const id of explorationIds) accumulate(out, metricsByExp[id]);
  return out;
}

/** Sum already-aggregated child metrics (e.g. node → era, era → project). */
export function sumMetrics(parts: (EvolutionMetrics | undefined)[]): EvolutionMetrics {
  const out = emptyMetrics();
  for (const m of parts) {
    if (!m) continue;
    out.toolCount += m.toolCount;
    out.errorCount += m.errorCount;
    out.retrievals += m.retrievals;
    out.writes += m.writes;
    out.interrupted += m.interrupted;
    if (typeof m.tokens === 'number') out.tokens = (out.tokens ?? 0) + m.tokens;
    if (m.files && m.files.length) {
      const set = new Set(out.files ?? []);
      for (const f of m.files) set.add(f);
      out.files = [...set];
    }
  }
  return out;
}

/**
 * The explorationIds backing one milestone node: the pivot revision plus its folded
 * children. We re-derive them from the node id (`sessionId:explorationId`) plus the
 * children's source revisions — but children carry only title/at, so the caller passes
 * the explicit id list. This helper just clones metrics with an elapsedMs stamp.
 */
export function withElapsed(metrics: EvolutionMetrics, elapsedMs: number | undefined): EvolutionMetrics {
  if (typeof elapsedMs === 'number' && elapsedMs > 0) metrics.elapsedMs = elapsedMs;
  return metrics;
}

/** Collect a node's explorationIds (pivot + children) given the node and its child ids. */
export function nodeMetrics(
  node: Pick<EvolutionNode, 'id'>,
  childExplorationIds: string[],
  metricsByExp: Record<string, ExplorationMetricsRaw>,
  elapsedMs?: number,
): EvolutionMetrics {
  // node.id is `${sessionId}:${explorationId}` — the pivot exploration.
  const pivotExpId = node.id.includes(':') ? node.id.slice(node.id.indexOf(':') + 1) : node.id;
  const ids = [pivotExpId, ...childExplorationIds];
  return withElapsed(aggregateExplorations(ids, metricsByExp), elapsedMs);
}
