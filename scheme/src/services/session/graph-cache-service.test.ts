import { describe, expect, it } from 'bun:test';
import type { FlowGraphSnapshot, SessionFlowRecord, SessionId } from '../../data/protocol/observer-protocol';
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
        intentKey: 'general',
      },
    ],
    edges: [],
    focusNodeId: `${sessionId}:node_1`,
    updatedAt: 1,
  };
}

class InMemorySessionFlowRepository {
  private data = new Map<SessionId, SessionFlowRecord>();

  load(sessionId: SessionId) {
    return this.data.get(sessionId) ?? null;
  }

  save(record: SessionFlowRecord) {
    this.data.set(record.sessionId, record);
  }

  clear(sessionId: SessionId) {
    this.data.delete(sessionId);
  }
}

describe('graph cache service', () => {
  it('returns miss when session record not found', () => {
    const service = new DefaultGraphCacheService(new InMemorySessionFlowRepository());
    const result = service.loadGraphSnapshotWithStatus({
      sessionId: 's1',
      jsonlMtime: 1,
      fingerprint: 'fp',
    });
    expect(result.status).toBe('miss');
    expect(result.reason).toBe('session_record_not_found');
  });

  it('returns hit when session/mtime/fingerprint all match', () => {
    const repository = new InMemorySessionFlowRepository();
    const service = new DefaultGraphCacheService(repository);
    const snapshot = makeSnapshot('s2');
    const workspaceRoot = '/tmp/flow-test-workspace';
    service.saveSessionFlow({
      sessionId: 's2',
      jsonlMtime: 20,
      fingerprint: 'fp2',
      snapshot,
      flowchartHints: { exp_1: { nodeId: 'n1', nodeTitle: 'T', parentId: null, branchType: 'trunk', importance: 'medium', dropFromChart: false, intentKey: 'n1' } },
      workspaceRoot,
    });

    const result = service.loadGraphSnapshotWithStatus({
      sessionId: 's2',
      jsonlMtime: 20,
      fingerprint: 'fp2',
      workspaceRoot,
    });
    expect(result.status).toBe('hit');
    expect(result.snapshot).toEqual(snapshot);
    expect(result.flowchartHints?.exp_1?.nodeTitle).toBe('T');
    expect(result.revision).toBe(1);
  });

  it('returns stale when mtime differs', () => {
    const service = new DefaultGraphCacheService(new InMemorySessionFlowRepository());
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
    const service = new DefaultGraphCacheService(new InMemorySessionFlowRepository());
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

  it('returns stale when workspaceRoot is missing', () => {
    const repository = new InMemorySessionFlowRepository();
    const service = new DefaultGraphCacheService(repository);
    repository.save({
      version: 2,
      sessionId: 's6',
      jsonlMtime: 60,
      fingerprint: 'fp6',
      revision: 1,
      updatedAt: 1,
      flowGraph: makeSnapshot('s6'),
      flowchartHints: {},
    });
    const result = service.loadGraphSnapshotWithStatus({
      sessionId: 's6',
      jsonlMtime: 60,
      fingerprint: 'fp6',
      workspaceRoot: '/repo/a',
    });
    expect(result.status).toBe('stale');
    expect(result.reason).toBe('workspace_root_missing');
  });

  it('returns corrupted when workspace mismatches', () => {
    const repository = new InMemorySessionFlowRepository();
    const service = new DefaultGraphCacheService(repository);
    service.saveSessionFlow({
      sessionId: 's5',
      jsonlMtime: 50,
      fingerprint: 'fp5',
      snapshot: makeSnapshot('s5'),
      flowchartHints: {},
      workspaceRoot: '/repo/a',
    });
    const result = service.loadGraphSnapshotWithStatus({
      sessionId: 's5',
      jsonlMtime: 50,
      fingerprint: 'fp5',
      workspaceRoot: '/repo/b',
    });
    expect(result.status).toBe('corrupted');
    expect(result.reason).toBe('workspace_mismatch');
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
