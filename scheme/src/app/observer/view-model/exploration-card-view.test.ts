import { describe, expect, it } from 'bun:test';
import {
  buildCompactLine,
  buildLiveFootnote,
  resolveCardDisplayMode,
  shouldShowInlineSummary,
} from './exploration-card-view';

describe('resolveCardDisplayMode', () => {
  it('returns compact for non-latest cards when calm mode is on', () => {
    expect(resolveCardDisplayMode({ calmMode: true, isLatestExploration: false })).toBe('compact');
  });

  it('returns expanded for the latest card when calm mode is on', () => {
    expect(resolveCardDisplayMode({ calmMode: true, isLatestExploration: true })).toBe('expanded');
  });

  it('returns expanded for all cards when calm mode is off', () => {
    expect(resolveCardDisplayMode({ calmMode: false, isLatestExploration: false })).toBe('expanded');
  });

  it('respects manual expansion override', () => {
    expect(resolveCardDisplayMode({ calmMode: true, manuallyExpanded: true })).toBe('expanded');
  });
});

describe('buildLiveFootnote', () => {
  it('uses summarizing badge while summary is generating', () => {
    const view = buildLiveFootnote({
      status: 'complete',
      spinnerFrame: '◷',
      toolCount: 2,
      errorCount: 0,
      isGenerating: true,
    });
    expect(view.statusBadge).toBe('Summarizing');
  });

  it('keeps active badge while running', () => {
    const view = buildLiveFootnote({
      status: 'running',
      spinnerFrame: '◷',
      toolCount: 1,
      errorCount: 0,
      isGenerating: false,
    });
    expect(view.statusBadge).toBe('◷ Active');
  });
});

describe('shouldShowInlineSummary', () => {
  it('shows placeholder while generating in expanded mode', () => {
    expect(shouldShowInlineSummary('expanded', 'complete', true)).toBe(true);
  });

  it('shows summary in expanded complete state', () => {
    expect(shouldShowInlineSummary('expanded', 'complete', false)).toBe(true);
  });

  it('hides summary on compact cards (calm collapsed rows)', () => {
    expect(shouldShowInlineSummary('compact', 'complete', false)).toBe(false);
  });

  it('hides summary while running', () => {
    expect(shouldShowInlineSummary('expanded', 'running', false)).toBe(false);
  });
});

describe('buildCompactLine', () => {
  it('formats a single-line calm summary without wiki write', () => {
    const line = buildCompactLine({
      question: 'hello world',
      status: 'complete',
      spinnerFrame: '◷',
      toolCount: 3,
      isGenerating: false,
    });
    expect(line).toContain('hello world');
    expect(line).toContain('Done');
    expect(line).toContain('3 tools');
    expect(line).not.toContain('wiki');
  });
});
