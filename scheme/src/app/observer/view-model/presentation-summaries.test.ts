import { describe, expect, it } from 'bun:test';
import type { Exploration, SummaryItem } from '../../../data/protocol/observer-protocol';
import { applyExcerptFallback, applyLiveSummaryPreview, isExplorationSummarizing, resolveSummaryDisplayTier } from './presentation-summaries';

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

describe('resolveSummaryDisplayTier', () => {
  it('shows cached for persisted wiki summaries', () => {
    expect(resolveSummaryDisplayTier(summary({ source: 'cache' }))).toBe('cache');
    expect(resolveSummaryDisplayTier(summary({ source: 'wiki' }))).toBe('cache');
  });

  it('shows fallback for AI failure paths', () => {
    expect(resolveSummaryDisplayTier(summary({ source: 'fallback' }))).toBe('fallback');
    expect(resolveSummaryDisplayTier(summary({ source: 'fallback', reason: 'always-fail' }))).toBe('fallback');
  });

  it('shows no badge for fresh AI or live preview', () => {
    expect(resolveSummaryDisplayTier(summary({ source: 'ai' }))).toBeNull();
    expect(resolveSummaryDisplayTier(summary({ source: 'excerpt', reason: 'live_preview' }))).toBeNull();
  });
});

describe('isExplorationSummarizing', () => {
  it('is true only when this exploration is pending', () => {
    expect(isExplorationSummarizing(
      exploration('complete'),
      summary({ source: 'excerpt', reason: 'live_preview', text: 'preview…' }),
      true,
    )).toBe(true);
    expect(isExplorationSummarizing(
      exploration('complete'),
      summary({ source: 'excerpt', reason: 'live_preview', text: 'preview…' }),
      false,
    )).toBe(false);
  });

  it('is false when cached summary is ready even if another exploration is pending', () => {
    expect(isExplorationSummarizing(
      exploration('complete'),
      summary({ source: 'cache', text: 'cached body' }),
      true,
    )).toBe(false);
  });

  it('is false when AI summary is ready', () => {
    expect(isExplorationSummarizing(exploration('complete'), summary(), true)).toBe(false);
  });

  it('is false for replay timeline excerpt', () => {
    expect(isExplorationSummarizing(
      exploration('complete'),
      summary({ source: 'fallback', reason: 'timeline_excerpt', text: 'excerpt body' }),
      true,
    )).toBe(false);
  });
});

describe('applyLiveSummaryPreview', () => {
  it('skips live preview when bundle already has summary for exploration', () => {
    const explorations = [exploration('complete')];
    const items = applyLiveSummaryPreview('session-1', explorations, {}, { exp_1: true });
    expect(Object.keys(items)).toHaveLength(0);
  });

  it('adds live preview when bundle has no summary', () => {
    const explorations = [exploration('complete')];
    const items = applyLiveSummaryPreview('session-1', explorations, {}, {});
    expect(Object.values(items)[0]?.reason).toBe('live_preview');
  });
});
