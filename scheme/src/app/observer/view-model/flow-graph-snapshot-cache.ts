/**
 * Incremental snapshot cache for buildFlowGraphSnapshot.
 *
 * Problem: LiveObserverFlowBody receives a new explorations[] array every 500 ms.
 * Even when no new turn has landed, buildFlowGraphSnapshot re-scans all
 * explorations — O(N) per tick — even though the output is identical.
 *
 * Solution: Wrap the builder with an ID-detect cache.  Rebuild only when
 *   - A brand-new exploration.id appears (a new turn arrived), OR
 *   - An existing exploration.status changed (e.g. running → complete), OR
 *   - One of the static inputs (summaries / hints / wikiPersistStatus) changed.
 */

import { buildFlowGraphSnapshot as _buildFlowGraphSnapshot, type BuildFlowGraphInput } from './flow-graph-builder';
import type { FlowGraphSnapshot } from '../../../data/protocol/observer-protocol';
import { buildGraphFingerprint } from '../../../utils/graph-fingerprint';

interface SnapshotCacheEntry {
  /** Fingerprint of sorted exploration IDs + status per id */
  idFingerprint: string;
  result: FlowGraphSnapshot;
}

export interface CachedBuildFlowGraphSnapshot {
  /** Call this instead of the raw builder. Returns memoized snapshot when unchanged. */
  (input: BuildFlowGraphInput): FlowGraphSnapshot;
  /** Force a rebuild regardless of fingerprint. */
  invalidate(): void;
}

export function createCachedBuilder(): CachedBuildFlowGraphSnapshot {
  let lastEntry: SnapshotCacheEntry | null = null;

  function cached(input: BuildFlowGraphInput): FlowGraphSnapshot {
    const fp = buildGraphFingerprint({
      explorations: input.explorations,
      summaries: input.summaries,
      flowchartHints: input.flowchartHints,
      wikiPersistStatus: input.wikiPersistStatus,
    });

    if (lastEntry && lastEntry.idFingerprint === fp) {
      return lastEntry.result;
    }

    const result = _buildFlowGraphSnapshot(input);
    lastEntry = { idFingerprint: fp, result, ...input };
    return result;
  }

  cached.invalidate = (): void => {
    lastEntry = null;
  };

  return cached;
}
