import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../data/protocol/observer-protocol';
import { ensureExplorationCardRetrieval } from './exploration-card-pipeline';

function exploration(question: string): Exploration {
  return {
    id: 'exp_1',
    question,
    startedAt: 1,
    status: 'complete',
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [{ id: 'n1', type: 'tool', label: 'bash', status: 'ok', timestamp: 1 }],
  };
}

describe('exploration-card-pipeline', () => {
  it('delegates retrieval ensure to wiki-retrieval-policy', () => {
    const repo = {
      load: () => null,
      patchExploration: () => {
        throw new Error('should not patch without jsonl in this unit');
      },
    };
    const match = ensureExplorationCardRetrieval({
      sessionId: 's1',
      exploration: exploration('short'),
      jsonlPath: '',
      allowLiveSearch: false,
      bundleRepository: repo as never,
    });
    expect(match).toBeNull();
  });
});
