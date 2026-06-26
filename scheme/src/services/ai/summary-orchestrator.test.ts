import { describe, expect, it } from 'bun:test';
import { buildGenerateTriggerKey, shouldGenerateMissingSummaries, SummaryOrchestrator } from './summary-orchestrator';
import type { Exploration, SessionScopedId, SummaryItem } from '../../data/protocol/observer-protocol';
import type { CacheHydrateResult, ExplorationSummaryService, SummaryRuntimeStats } from './exploration-summary-service';

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

  it('plans run pendingCount from missing summaries', () => {
    const orchestrator = new SummaryOrchestrator(new FakeSummaryService());
    const decision = orchestrator.planGenerate({
      allowRegen: true,
      sessionId: 'sid',
      summariesReadyKey: 'sid|/tmp/a.jsonl',
      sessionPath: '/tmp/a.jsonl',
      explorations: [
        exploration('exp_1'),
        exploration('exp_2'),
        exploration('exp_3', 'running'),
      ],
      items: {
        'sid:exp_1': {
          id: 'sid:exp_1',
          sessionId: 'sid',
          explorationId: 'exp_1',
          text: 'cached',
          source: 'cache',
          status: 'ready',
          persistMeta: null,
        },
      },
      bundleSummaryByExplorationId: {},
    });

    expect(decision.action).toBe('run');
    expect(decision.pendingCount).toBe(1);
  });
});

class FakeSummaryService implements ExplorationSummaryService {
  hydrateFromBundle(): CacheHydrateResult {
    return { items: {}, cacheStatus: 'miss', cacheReason: 'test' };
  }

  async generateMissing(): Promise<Record<SessionScopedId, SummaryItem>> {
    return {};
  }

  resetSession(): void {}

  pendingCount(): number {
    return 0;
  }

  isExplorationPending(): boolean {
    return false;
  }

  getRuntimeStats(): SummaryRuntimeStats {
    return {
      queued: 0,
      active: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      avgDurationMs: 0,
      maxConcurrentObserved: 0,
    };
  }
}
