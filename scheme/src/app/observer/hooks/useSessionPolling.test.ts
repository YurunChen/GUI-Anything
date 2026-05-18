import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import { shouldUpdateSessionData } from './useSessionPolling';

function makeExploration(id: string, status: Exploration['status']): Exploration {
  return {
    id,
    question: id,
    startedAt: 1,
    endedAt: status === 'running' ? undefined : 2,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [],
  };
}

describe('shouldUpdateSessionData', () => {
  it('updates when session identity changes', () => {
    const changed = shouldUpdateSessionData(
      {
        sessionPath: '/tmp/a.jsonl',
        sessionId: 'a',
        sourceMtimeMs: 1,
        explorations: [makeExploration('exp_1', 'running')],
      },
      {
        sessionPath: '/tmp/b.jsonl',
        sessionId: 'b',
        sourceMtimeMs: 1,
        explorations: [makeExploration('exp_1', 'running')],
      },
    );
    expect(changed).toBe(true);
  });

  it('updates when source mtime changes even if ids/status stay stable', () => {
    const changed = shouldUpdateSessionData(
      {
        sessionPath: '/tmp/a.jsonl',
        sessionId: 'a',
        sourceMtimeMs: 100,
        explorations: [makeExploration('exp_1', 'running')],
      },
      {
        sessionPath: '/tmp/a.jsonl',
        sessionId: 'a',
        sourceMtimeMs: 101,
        explorations: [makeExploration('exp_1', 'running')],
      },
    );
    expect(changed).toBe(true);
  });

  it('does not update for identical identity and exploration id/status shape', () => {
    const changed = shouldUpdateSessionData(
      {
        sessionPath: '/tmp/a.jsonl',
        sessionId: 'a',
        sourceMtimeMs: 101,
        explorations: [makeExploration('exp_1', 'running')],
      },
      {
        sessionPath: '/tmp/a.jsonl',
        sessionId: 'a',
        sourceMtimeMs: 101,
        explorations: [makeExploration('exp_1', 'running')],
      },
    );
    expect(changed).toBe(false);
  });
});
