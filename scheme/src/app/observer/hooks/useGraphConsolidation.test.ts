import { describe, expect, it } from 'bun:test';
import { shouldTriggerConsolidation } from './useGraphConsolidation';

describe('shouldTriggerConsolidation', () => {
  it('triggers consolidation every 3 completed explorations', () => {
    expect(shouldTriggerConsolidation(3, 0)).toBe(true);
    expect(shouldTriggerConsolidation(5, 2)).toBe(true);
  });

  it('does not trigger before threshold', () => {
    expect(shouldTriggerConsolidation(2, 0)).toBe(false);
    expect(shouldTriggerConsolidation(4, 2)).toBe(false);
  });
});
