import { describe, expect, it } from 'bun:test';
import type { FlowchartHint } from '../../data/protocol/observer-protocol';
import { applyGraphPatch, DefaultGraphPatchService } from './graph-patch-service';

function makeHints(): Record<string, FlowchartHint> {
  return {
    exp_1: {
      nodeId: 'a',
      nodeTitle: 'Intent A',
      parentId: null,
      branchType: 'trunk',
      importance: 'high',
      dropFromChart: false,
      intentKey: 'a',
    },
    exp_2: {
      nodeId: 'b',
      nodeTitle: 'Intent B',
      parentId: 'a',
      branchType: 'parallel',
      importance: 'high',
      dropFromChart: false,
      intentKey: 'b',
    },
  };
}

describe('applyGraphPatch', () => {
  it('rejects patch that creates parent cycle', () => {
    const result = applyGraphPatch(makeHints(), [
      {
        op: 'reparent_intent',
        targetIntentKey: 'a',
        newParentIntentKey: 'a',
        reason: 'bad',
        confidence: 0.9,
      },
    ]);
    expect(result.applied).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('applies merge patch to source intents', () => {
    const result = applyGraphPatch(makeHints(), [
      {
        op: 'merge_intents',
        sourceIntentKeys: ['a', 'b'],
        targetIntentKey: 'ab',
        reason: 'duplicate',
        confidence: 0.8,
      },
    ]);
    expect(result.applied).toBe(true);
    expect(result.nextHints.exp_1.intentKey).toBe('ab');
    expect(result.nextHints.exp_2.intentKey).toBe('ab');
  });

  it('compacts persisted patch ledger to bounded size', () => {
    class InMemoryPatchRepository {
      private ledger: any = null;
      load() { return this.ledger; }
      save(_sessionId: string, ledger: any) { this.ledger = ledger; }
      clear() { this.ledger = null; }
    }
    const repository = new InMemoryPatchRepository();
    const service = new DefaultGraphPatchService(repository as any);
    const bulkPatches = Array.from({ length: 25 }, (_, index) => ({
      op: 'drop_intent' as const,
      targetIntentKey: index % 2 === 0 ? 'a' : 'b',
      reason: `r${index}`,
      confidence: 0.7,
    }));
    service.appendAndApply('s1', makeHints(), bulkPatches);
    const ledger = service.loadLedger('s1');
    expect(ledger.patches.length).toBeLessThanOrEqual(20);
  });
});
