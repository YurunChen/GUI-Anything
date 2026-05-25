import { describe, expect, it } from 'bun:test';
import { buildIntentDigest, shouldSkipIntentCurate } from './intent-digest-service';
import type { Exploration, IntentBucket } from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';

function exploration(id: string, question: string): Exploration {
  return {
    id,
    question,
    startedAt: 0,
    status: 'complete',
    currentPhase: 'idle',
    phaseSeen: { explore: true, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [{ id: 'n1', type: 'tool', label: 'bash', status: 'ok', timestamp: 1, rawCommand: 'ls' }],
  };
}

describe('intent-digest-service', () => {
  const bucket: IntentBucket = {
    intentKey: 'topic_a',
    nodeTitle: 'Analyze project',
    explorationIds: ['exp_1', 'exp_2'],
  };

  it('builds multi-turn digest from bucket explorations', () => {
    const sessionId = 's1';
    const summaries = {
      [makeSessionScopedId(sessionId, 'exp_1')]: {
        id: makeSessionScopedId(sessionId, 'exp_1'),
        sessionId,
        explorationId: 'exp_1',
        text: 'First summary',
        source: 'ai' as const,
        status: 'ready' as const,
        persistMeta: { solution_detail: 'detail 1', type: 'context', confidence: 0.8, tags: ['a'] },
      },
      [makeSessionScopedId(sessionId, 'exp_2')]: {
        id: makeSessionScopedId(sessionId, 'exp_2'),
        sessionId,
        explorationId: 'exp_2',
        text: 'Second summary',
        source: 'ai' as const,
        status: 'ready' as const,
        persistMeta: { solution_detail: 'detail 2', type: 'context', confidence: 0.8, tags: ['b'] },
      },
    };

    const digest = buildIntentDigest({
      sessionId,
      bucket,
      summaries,
      explorations: [exploration('exp_1', 'Q1'), exploration('exp_2', 'Q2')],
    });

    expect(digest?.explorations).toHaveLength(2);
    expect(digest?.combinedSummary).toContain('Turn 1');
    expect(digest?.combinedSummary).toContain('Turn 2');
  });

  it('skips all-low-value buckets', () => {
    const sessionId = 's1';
    const summaries = {
      [makeSessionScopedId(sessionId, 'exp_1')]: {
        id: makeSessionScopedId(sessionId, 'exp_1'),
        sessionId,
        explorationId: 'exp_1',
        text: 'hello',
        source: 'ai' as const,
        status: 'ready' as const,
        persistMeta: null,
      },
    };

    expect(shouldSkipIntentCurate({
      sessionId,
      bucket: { ...bucket, explorationIds: ['exp_1'] },
      summaries,
      explorations: [{
        ...exploration('exp_1', 'hi'),
        nodes: [],
      }],
    })).toBe('low_value');
  });
});
