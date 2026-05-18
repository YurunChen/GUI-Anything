import { describe, expect, it } from 'bun:test';
import { buildOutcomeSummary, deriveActivityState } from './activity-state';

const baseInput = {
  explorations: [],
  pendingSummaryCount: 0,
  persistPendingCount: 0,
  directionsStatus: 'idle' as const,
};

describe('deriveActivityState', () => {
  it('prefers running tools state', () => {
    const state = deriveActivityState({
      ...baseInput,
      explorations: [
        {
          id: 'exp_1',
          question: 'q',
          startedAt: 0,
          status: 'running',
          currentPhase: 'execute',
          phaseSeen: { explore: true, execute: true, verify: false },
          errorCounts: { tool: 0, system: 0, result: 0 },
          nodes: [],
        },
      ],
    });
    expect(state.label).toContain('Running tools');
    expect(state.spinning).toBe(true);
  });

  it('falls back to summarizing state', () => {
    const state = deriveActivityState({
      ...baseInput,
      pendingSummaryCount: 2,
    });
    expect(state.label).toContain('Summarizing');
    expect(state.spinning).toBe(true);
  });

  it('returns idle when nothing is active', () => {
    const state = deriveActivityState(baseInput);
    expect(state.label).toBe('Idle');
    expect(state.tone).toBe('idle');
  });
});

describe('buildOutcomeSummary', () => {
  it('builds concise status-only summary text', () => {
    const line = buildOutcomeSummary({
      summaryCount: 8,
      savedCount: 3,
      skippedCount: 4,
      failedCount: 1,
      errorCount: 0,
    });
    expect(line).toContain('summaries:8');
    expect(line).toContain('saved:3');
    expect(line).toContain('skipped:4');
    expect(line).toContain('failed:1');
  });
});
