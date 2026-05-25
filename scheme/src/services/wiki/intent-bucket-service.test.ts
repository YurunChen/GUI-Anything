import { describe, expect, it } from 'bun:test';
import type { FlowchartHint, SessionIntentState } from '../../data/protocol/observer-protocol';
import { IntentBucketService } from './intent-bucket-service';
import type { IntentBucketRepository } from '../../data/wiki/intent-bucket-repository';

class MemoryBucketRepo implements IntentBucketRepository {
  private store = new Map<string, ReturnType<IntentBucketService['load']>>();

  load(sessionId: string) {
    return this.store.get(sessionId) ?? null;
  }

  save(ledger: ReturnType<IntentBucketService['load']>) {
    this.store.set(ledger.sessionId, ledger);
  }

  clear(sessionId: string) {
    this.store.delete(sessionId);
  }
}

function priorIntent(key: string, title: string): SessionIntentState {
  return {
    sessionId: 's1',
    revision: 1,
    intentKey: key,
    nodeTitle: title,
    parentIntentKey: null,
    phase: 'active',
    history: [{
      explorationId: 'exp_0',
      at: 1,
      intentKey: key,
      nodeTitle: title,
      titleDelta: 'pivot',
    }],
    updatedAt: 1,
  };
}

function hint(overrides: Partial<FlowchartHint> & Pick<FlowchartHint, 'titleDelta' | 'intentKey'>): FlowchartHint {
  return {
    nodeId: 'n1',
    nodeTitle: 'Title',
    parentId: null,
    branchType: 'trunk',
    importance: 'medium',
    dropFromChart: false,
    ...overrides,
  };
}

describe('IntentBucketService', () => {
  it('accumulates explorations on continue without curate signal', () => {
    const repo = new MemoryBucketRepo();
    const service = new IntentBucketService(repo);
    const prior = priorIntent('project_design', 'Analyze');

    service.recordSummary({
      sessionId: 's1',
      explorationId: 'exp_1',
      hint: hint({ titleDelta: 'continue', intentKey: 'project_design', nodeTitle: 'Analyze' }),
      priorIntent: prior,
      nodeTitle: 'Analyze',
    });

    const record = service.recordSummary({
      sessionId: 's1',
      explorationId: 'exp_2',
      hint: hint({ titleDelta: 'continue', intentKey: 'project_design', nodeTitle: 'Analyze deeper' }),
      priorIntent: prior,
      nodeTitle: 'Analyze deeper',
    });

    expect(record.curateIntentKey).toBeNull();
    expect(record.ledger.buckets.project_design.explorationIds).toEqual(['exp_1', 'exp_2']);
    expect(record.ledger.buckets.project_design.curatedAt).toBeUndefined();
  });

  it('returns curateIntentKey on pivot between real intents', () => {
    const repo = new MemoryBucketRepo();
    const service = new IntentBucketService(repo);
    const prior = priorIntent('project_design', 'Analyze');

    service.recordSummary({
      sessionId: 's1',
      explorationId: 'exp_1',
      hint: hint({ titleDelta: 'continue', intentKey: 'project_design' }),
      priorIntent: prior,
      nodeTitle: 'Analyze',
    });

    const record = service.recordSummary({
      sessionId: 's1',
      explorationId: 'exp_2',
      hint: hint({ titleDelta: 'pivot', intentKey: 'implement', nodeTitle: 'Wiki plan' }),
      priorIntent: prior,
      nodeTitle: 'Wiki plan',
    });

    expect(record.curateIntentKey).toBe('project_design');
    expect(record.anchorExplorationId).toBe('exp_2');
    expect(record.ledger.buckets.project_design.explorationIds).toEqual(['exp_1', 'exp_2']);
    expect(record.ledger.openIntentKey).toBe('implement');
  });
});
