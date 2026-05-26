import { describe, expect, it } from 'bun:test';
import type { SessionFlowRecord } from '../../data/protocol/observer-protocol';
import { buildSessionFlowRecord, DefaultSessionFlowStore } from './session-flow-store';

class InMemorySessionFlowRepository {
  private data = new Map<string, SessionFlowRecord>();

  load(sessionId: string) {
    return this.data.get(sessionId) ?? null;
  }

  save(record: SessionFlowRecord) {
    this.data.set(record.sessionId, record);
  }

  clear(sessionId: string) {
    this.data.delete(sessionId);
  }
}

describe('session flow store', () => {
  it('persists flowGraph and flowchartHints with incrementing revision', () => {
    const repo = new InMemorySessionFlowRepository();
    const store = new DefaultSessionFlowStore(repo);
    const input = {
      sessionId: 'sess-a',
      jsonlMtime: 42,
      explorations: [
        {
          id: 'exp_1',
          question: 'fix tests',
          startedAt: 1,
          endedAt: 2,
          status: 'complete' as const,
          currentPhase: 'idle' as const,
          phaseSeen: { explore: false, execute: false, verify: false },
          errorCounts: { tool: 0, system: 0, result: 0 },
          nodes: [],
        },
      ],
      summaries: { exp_1: 'done' },
      flowchartHints: {
        exp_1: {
          nodeId: 'fix_tests',
          nodeTitle: 'Fix tests',
          parentId: null,
          branchType: 'trunk' as const,
          importance: 'high' as const,
          dropFromChart: false,
          intentKey: 'fix_tests',
        },
      },
    };

    const first = store.persist(input);
    expect(first.revision).toBe(1);
    expect(first.flowGraph.nodes.length).toBeGreaterThan(0);
    expect(first.flowchartHints.exp_1?.nodeTitle).toBe('Fix tests');

    const second = store.persist(input);
    expect(second.revision).toBe(2);

    const loaded = store.load('sess-a');
    expect(loaded?.flowGraph.nodes.length).toBe(first.flowGraph.nodes.length);
  });

  it('buildSessionFlowRecord starts revision at 0 before save', () => {
    const record = buildSessionFlowRecord({
      sessionId: 's',
      jsonlMtime: 1,
      explorations: [],
      summaries: {},
      flowchartHints: {},
    });
    expect(record.revision).toBe(0);
    expect(record.version).toBe(2);
    expect(record.workspaceRoot).toBeTruthy();
  });
});
