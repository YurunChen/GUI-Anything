import { describe, expect, it } from 'bun:test';
import type { Exploration, SummaryItem } from '../../../data/protocol/observer-protocol';
import { isExplorationSummarizing } from './presentation-summaries';

function exploration(status: Exploration['status']): Exploration {
  return {
    id: 'exp_1',
    question: 'q',
    startedAt: 0,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [{ id: 'n1', type: 'tool', label: 'bash', status: 'ok', timestamp: 1 }],
  };
}

function summary(overrides: Partial<SummaryItem> = {}): SummaryItem {
  return {
    id: 's:exp_1',
    sessionId: 's',
    explorationId: 'exp_1',
    text: 'done',
    source: 'ai',
    status: 'ready',
    persistMeta: null,
    ...overrides,
  };
}

describe('isExplorationSummarizing', () => {
  it('is true for live_preview placeholder', () => {
    expect(isExplorationSummarizing(
      exploration('complete'),
      summary({ source: 'excerpt', reason: 'live_preview', text: 'Claude round record…' }),
      0,
    )).toBe(true);
  });

  it('is false when AI summary is ready', () => {
    expect(isExplorationSummarizing(exploration('complete'), summary(), 1)).toBe(false);
  });

  it('is false for replay timeline excerpt', () => {
    expect(isExplorationSummarizing(
      exploration('complete'),
      summary({ source: 'excerpt', reason: 'timeline_excerpt', text: 'excerpt body' }),
      0,
    )).toBe(false);
  });
});
