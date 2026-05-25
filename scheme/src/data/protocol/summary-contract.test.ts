import { describe, expect, it } from 'bun:test';
import {
  getSummaryItemForExploration,
  normalizeSummaryItems,
  toExplorationSummaryTextMap,
} from './summary-contract';
import type { SummaryItem } from './observer-protocol';

describe('summary-contract', () => {
  it('getSummaryItemForExploration resolves by exploration id', () => {
    const items: Record<string, SummaryItem> = {
      's1:exp_1': {
        id: 's1:exp_1',
        sessionId: 's1',
        explorationId: 'exp_1',
        text: 'hello',
        source: 'ai',
        status: 'ready',
        persistMeta: null,
      },
      's1:exp_2': {
        id: 's1:exp_2',
        sessionId: 's1',
        explorationId: 'exp_2',
        text: 'analysis',
        source: 'ai',
        status: 'ready',
        persistMeta: null,
      },
    };
    expect(getSummaryItemForExploration(items, 'exp_2')?.text).toBe('analysis');
  });

  it('normalizeSummaryItems fixes session-scoped ids', () => {
    const items: Record<string, SummaryItem> = {
      'wrong:exp_1': {
        id: 'wrong:exp_1',
        sessionId: 'wrong',
        explorationId: 'exp_1',
        text: 'x',
        source: 'cache',
        status: 'ready',
        persistMeta: null,
      },
    };
    const normalized = normalizeSummaryItems('real-session', items);
    expect(normalized['real-session:exp_1'].sessionId).toBe('real-session');
    expect(normalized['real-session:exp_1'].id).toBe('real-session:exp_1');
  });

  it('toExplorationSummaryTextMap keys by exploration id', () => {
    const map = toExplorationSummaryTextMap({
      's:exp_1': {
        id: 's:exp_1',
        sessionId: 's',
        explorationId: 'exp_1',
        text: 'one',
        source: 'ai',
        status: 'ready',
        persistMeta: null,
      },
    });
    expect(map.exp_1).toBe('one');
  });
});
