import { describe, expect, it } from 'bun:test';
import { buildGenerateTriggerKey, shouldGenerateMissingSummaries } from './summary-orchestrator';
import type { Exploration } from '../../data/protocol/observer-protocol';

function exploration(id: string, status: Exploration['status'] = 'complete'): Exploration {
  return {
    id,
    question: 'analyze project structure in detail',
    startedAt: 1,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: status === 'complete'
      ? [{ id: 'n1', type: 'tool', label: 'bash', status: 'ok', timestamp: 1 }]
      : [],
  };
}

describe('summary-orchestrator helpers', () => {
  it('buildGenerateTriggerKey lists complete explorations with nodes', () => {
    expect(buildGenerateTriggerKey([
      exploration('exp_1'),
      exploration('exp_2', 'running'),
    ])).toBe('exp_1');
  });

  it('shouldGenerateMissingSummaries requires hydrate key match', () => {
    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: 's1',
      summariesReadyKey: 's1|/tmp/a.jsonl',
      sessionPath: '/tmp/a.jsonl',
    })).toBe(true);
    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: 's1',
      summariesReadyKey: '',
      sessionPath: '/tmp/a.jsonl',
    })).toBe(false);
  });
});
