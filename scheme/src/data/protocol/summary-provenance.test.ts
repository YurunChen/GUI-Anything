import { describe, expect, it } from 'bun:test';
import type { SummaryItem } from './observer-protocol';
import {
  cardSummarySourceFromSummaryItem,
  isSummaryFallback,
  isSummaryFromSessionBundle,
  resolveSummaryDisplayTier,
  summaryItemFromSessionBundle,
  SUMMARY_REASON_FROM_SESSION_BUNDLE,
  SUMMARY_REASON_LIVE_PREVIEW,
  SUMMARY_REASON_TIMELINE_EXCERPT,
} from './summary-provenance';

function item(overrides: Partial<SummaryItem> = {}): SummaryItem {
  return {
    id: 's:exp_1',
    sessionId: 's',
    explorationId: 'exp_1',
    text: 'body',
    source: 'ai',
    status: 'ready',
    persistMeta: null,
    ...overrides,
  };
}

describe('summary-provenance', () => {
  it('marks session bundle hydrate as cached', () => {
    const hydrated = summaryItemFromSessionBundle('s', 'exp_1', {
      text: 'stored',
      source: 'ai',
      status: 'ready',
      savedAt: 1,
    });
    expect(hydrated.source).toBe('cache');
    expect(hydrated.reason).toBe(SUMMARY_REASON_FROM_SESSION_BUNDLE);
    expect(resolveSummaryDisplayTier(hydrated)).toBe('cache');
  });

  it('shows cached for wiki/cache sources only', () => {
    expect(resolveSummaryDisplayTier(item({ source: 'cache' }))).toBe('cache');
    expect(resolveSummaryDisplayTier(item({ source: 'wiki' }))).toBe('cache');
  });

  it('shows fallback only for fallback paths', () => {
    expect(resolveSummaryDisplayTier(item({ source: 'fallback', reason: 'always-fail' }))).toBe('fallback');
    expect(resolveSummaryDisplayTier(item({
      source: 'excerpt',
      reason: SUMMARY_REASON_TIMELINE_EXCERPT,
    }))).toBe('fallback');
  });

  it('shows no badge for fresh AI or live preview', () => {
    expect(resolveSummaryDisplayTier(item({ source: 'ai' }))).toBeNull();
    expect(resolveSummaryDisplayTier(item({
      source: 'excerpt',
      reason: SUMMARY_REASON_LIVE_PREVIEW,
    }))).toBeNull();
  });

  it('does not treat AI with reason as fallback badge', () => {
    expect(resolveSummaryDisplayTier(item({ source: 'ai', reason: 'structured_output_x' }))).toBeNull();
  });

  it('maps persist source for bundle storage', () => {
    expect(cardSummarySourceFromSummaryItem(item({ source: 'ai' }))).toBe('ai');
    expect(cardSummarySourceFromSummaryItem(item({ source: 'fallback' }))).toBe('fallback');
    expect(cardSummarySourceFromSummaryItem(item({ source: 'cache' }))).toBe('fallback');
  });

  it('classifies provenance helpers', () => {
    expect(isSummaryFromSessionBundle(item({ source: 'cache' }))).toBe(true);
    expect(isSummaryFallback(item({ source: 'fallback' }))).toBe(true);
    expect(isSummaryFallback(item({ source: 'ai' }))).toBe(false);
  });
});
