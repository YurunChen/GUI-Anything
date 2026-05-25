import { describe, expect, it } from 'bun:test';
import type { FlowGraphSnapshot } from '../../../data/protocol/observer-protocol';
import { resolveGraphSnapshot } from './useGraphSnapshot';

const emptySnapshot: FlowGraphSnapshot = {
  nodes: [],
  edges: [],
  updatedAt: 1,
};

function makeInput() {
  return {
    sessionId: 'session-1',
    sessionPath: '/tmp/session-1.jsonl',
    sourceMtimeMs: 100,
    explorations: [],
    summaries: {},
    flowchartHints: {},
    wikiPersistStatus: {},
  };
}

describe('resolveGraphSnapshot', () => {
  it('returns cache hit snapshot immediately when cache is valid', () => {
    const input = makeInput();
    const result = resolveGraphSnapshot(
      input,
      {
        loadGraphSnapshotWithStatus: () => ({
          status: 'hit',
          reason: 'session_record_hit',
          snapshot: emptySnapshot,
          flowchartHints: {},
          revision: 1,
        }),
        saveGraphSnapshot: () => {},
        saveSessionFlow: () => {},
        clearGraphCache: () => {},
      },
      'fp-hit',
    );
    expect(result.cacheHit).toBe(true);
    expect(result.snapshot).toEqual(emptySnapshot);
    expect(result.shouldPersist).toBe(false);
  });

  it('rebuilds snapshot and marks persist when cache is stale', () => {
    const input = makeInput();
    const result = resolveGraphSnapshot(
      input,
      {
        loadGraphSnapshotWithStatus: () => ({
          status: 'stale',
          reason: 'input_fingerprint_mismatch',
          snapshot: null,
          flowchartHints: null,
          revision: null,
        }),
        saveGraphSnapshot: () => {},
        saveSessionFlow: () => {},
        clearGraphCache: () => {},
      },
      'fp-stale',
    );
    expect(result.cacheHit).toBe(false);
    expect(result.shouldPersist).toBe(true);
    expect(result.cacheStatus).toBe('stale');
  });
});
