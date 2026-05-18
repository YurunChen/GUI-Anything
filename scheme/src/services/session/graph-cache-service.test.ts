import { describe, expect, it } from 'bun:test';
import type { FlowGraphSnapshot, SessionId } from '../../data/protocol/observer-protocol';
import {
  DefaultGraphCacheService,
  buildGraphInputFingerprint,
} from './graph-cache-service';

function makeSnapshot(sessionId: string): FlowGraphSnapshot {
  return {
    nodes: [
      {
        id: `${sessionId}:node_1`,
        explorationId: 'exp_1',
        label: 'Node 1',
        status: 'complete',
        startedAt: 1,
        endedAt: 2,
        summaryPreview: 's1',
        metaBadges: { tools: 1, errors: 0, wiki: 'none' },
      },
    ],
    edges: [],
    focusNodeId: `${sessionId}:node_1`,
    updatedAt: 1,
  };
}

class InMemoryGraphCacheRepository {
  private data = new Map<SessionId, {
    sessionId: SessionId;
    jsonlMtime: number;
    savedAt: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
  }>();

  load(sessionId: SessionId) {
    return this.data.get(sessionId) ?? null;
  }

  save(record: {
    sessionId: SessionId;
    jsonlMtime: number;
    savedAt: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
  }) {
    this.data.set(record.sessionId, record);
  }

  clear(sessionId: SessionId) {
    this.data.delete(sessionId);
  }
}

describe('graph cache service', () => {
  it('returns miss when cache not found', () => {
    const service = new DefaultGraphCacheService(new InMemoryGraphCacheRepository());
    const result = service.loadGraphSnapshotWithStatus({
      sessionId: 's1',
      jsonlMtime: 1,
      fingerprint: 'fp',
    });
    expect(result.status).toBe('miss');
  });

  it('returns hit when session/mtime/fingerprint all match', () => {
    const repository = new InMemoryGraphCacheRepository();
    const service = new DefaultGraphCacheService(repository);
    const snapshot = makeSnapshot('s2');
    service.saveGraphSnapshot({
      sessionId: 's2',
      jsonlMtime: 20,
      fingerprint: 'fp2',
      snapshot,
    });

    const result = service.loadGraphSnapshotWithStatus({
      sessionId: 's2',
      jsonlMtime: 20,
      fingerprint: 'fp2',
    });
    expect(result.status).toBe('hit');
    expect(result.snapshot).toEqual(snapshot);
  });

  it('returns stale when mtime differs', () => {
    const service = new DefaultGraphCacheService(new InMemoryGraphCacheRepository());
    service.saveGraphSnapshot({
      sessionId: 's3',
      jsonlMtime: 100,
      fingerprint: 'fp3',
      snapshot: makeSnapshot('s3'),
    });
    const result = service.loadGraphSnapshotWithStatus({
      sessionId: 's3',
      jsonlMtime: 101,
      fingerprint: 'fp3',
    });
    expect(result.status).toBe('stale');
    expect(result.reason).toBe('jsonl_mtime_mismatch');
  });

  it('returns stale when fingerprint differs', () => {
    const service = new DefaultGraphCacheService(new InMemoryGraphCacheRepository());
    service.saveGraphSnapshot({
      sessionId: 's4',
      jsonlMtime: 100,
      fingerprint: 'fp4',
      snapshot: makeSnapshot('s4'),
    });
    const result = service.loadGraphSnapshotWithStatus({
      sessionId: 's4',
      jsonlMtime: 100,
      fingerprint: 'fp4-new',
    });
    expect(result.status).toBe('stale');
    expect(result.reason).toBe('input_fingerprint_mismatch');
  });

  it('builds stable fingerprint from graph inputs', () => {
    const fp1 = buildGraphInputFingerprint({
      explorations: [
        {
          id: 'exp_2',
          question: 'q2',
          startedAt: 2,
          endedAt: 3,
          status: 'complete',
          currentPhase: 'idle',
          phaseSeen: { explore: false, execute: false, verify: false },
          errorCounts: { tool: 0, system: 0, result: 0 },
          nodes: [],
        },
        {
          id: 'exp_1',
          question: 'q1',
          startedAt: 1,
          endedAt: 2,
          status: 'complete',
          currentPhase: 'idle',
          phaseSeen: { explore: false, execute: false, verify: false },
          errorCounts: { tool: 0, system: 0, result: 0 },
          nodes: [],
        },
      ],
      summaries: { exp_1: 'a', exp_2: 'b' },
      flowchartHints: undefined,
      wikiPersistStatus: undefined,
    });

    const fp2 = buildGraphInputFingerprint({
      explorations: [
        {
          id: 'exp_1',
          question: 'q1',
          startedAt: 1,
          endedAt: 2,
          status: 'complete',
          currentPhase: 'idle',
          phaseSeen: { explore: false, execute: false, verify: false },
          errorCounts: { tool: 0, system: 0, result: 0 },
          nodes: [],
        },
        {
          id: 'exp_2',
          question: 'q2',
          startedAt: 2,
          endedAt: 3,
          status: 'complete',
          currentPhase: 'idle',
          phaseSeen: { explore: false, execute: false, verify: false },
          errorCounts: { tool: 0, system: 0, result: 0 },
          nodes: [],
        },
      ],
      summaries: { exp_1: 'a', exp_2: 'b' },
      flowchartHints: undefined,
      wikiPersistStatus: undefined,
    });

    expect(fp1).toBe(fp2);
  });
});
