import { describe, expect, it } from 'bun:test';
import { buildOutcomeSummary, deriveActivityState } from './activity-state';

describe('deriveActivityState', () => {
  it('prefers running tools state', () => {
    const state = deriveActivityState({
      explorations: [{ status: 'running' } as never],
      pendingSummaryCount: 0,
      persistPendingCount: 0,
    });
    expect(state.tone).toBe('running');
    expect(state.spinning).toBe(true);
  });

  it('falls back to summarizing state', () => {
    const state = deriveActivityState({
      explorations: [],
      pendingSummaryCount: 2,
      persistPendingCount: 0,
    });
    expect(state.label).toContain('Summarizing');
  });

  it('returns idle when nothing is active', () => {
    const state = deriveActivityState({
      explorations: [],
      pendingSummaryCount: 0,
      persistPendingCount: 0,
    });
    expect(state.tone).toBe('idle');
  });
});

describe('buildOutcomeSummary', () => {
  it('builds concise status-only summary text', () => {
    const text = buildOutcomeSummary({
      summaryCount: 1,
      savedCount: 0,
      skippedCount: 1,
      failedCount: 0,
      errorCount: 0,
    });
    expect(text).toContain('summaries 1');
    expect(text).toContain('skipped 1');
  });
});
