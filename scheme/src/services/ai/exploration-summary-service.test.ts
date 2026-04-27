import { describe, expect, it } from 'bun:test';
import { DefaultExplorationSummaryService } from './exploration-summary-service';
import type { Exploration } from '../../data/protocol/observer-protocol';

describe('DefaultExplorationSummaryService', () => {
  it('does not generate when a session-scoped wiki summary already exists', async () => {
    const service = new DefaultExplorationSummaryService();
    const exploration: Exploration = {
      id: 'exp_1',
      question: 'why is summary mismatched?',
      startedAt: Date.now(),
      status: 'complete',
      currentPhase: 'idle',
      phaseSeen: { explore: true, execute: false, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
      nodes: [{
        id: 'n1',
        timestamp: Date.now(),
        type: 'response',
        label: 'done',
      }],
    };

    await expect(service.generateMissing({
      sessionId: 'session-a',
      explorations: [exploration],
      jsonlPath: '/tmp/test-session.jsonl',
      existing: {
        'session-a:exp_1': {
          id: 'session-a:exp_1',
          sessionId: 'session-a',
          explorationId: 'exp_1',
          text: 'from wiki',
          source: 'wiki',
          status: 'ready',
          persistMeta: null,
        },
      },
    })).resolves.toEqual({});
  });
});
