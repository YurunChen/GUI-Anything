import { describe, expect, it } from 'bun:test';
import {
  buildCompactLine,
  buildLiveFootnote,
  buildTimelineCardHeader,
  buildTimelineMetaLine,
  QUESTION_PREVIEW_MAX_LINES,
  resolveCardDisplayMode,
  resolveQuestionBody,
  shouldRenderTimelineSummary,
  shouldShowSummarySection,
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
  it('keeps the turn status static while summary is generating', () => {
    const view = buildLiveFootnote({
      status: 'complete',
      spinnerFrame: '◷',
      toolCount: 2,
      errorCount: 0,
      isGenerating: true,
    });
    expect(view.statusBadge).toBe('Done');
    expect(view.statusTone).toBe('complete');
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

describe('shouldShowSummarySection', () => {
  it('keeps the original behavior: summary appears after the turn output', () => {
    expect(shouldShowSummarySection('expanded', 'running')).toBe(false);
    expect(shouldShowSummarySection('expanded', 'complete')).toBe(true);
    expect(shouldShowSummarySection('expanded', 'interrupted')).toBe(true);
    expect(shouldShowSummarySection('compact', 'complete')).toBe(false);
  });
});

describe('shouldRenderTimelineSummary', () => {
  it('shows the summary loading section while the summary job is running', () => {
    expect(shouldRenderTimelineSummary({
      displayMode: 'expanded',
      status: 'complete',
      isGenerating: true,
    })).toBe(true);
  });

  it('keeps an existing summary visible during regeneration', () => {
    expect(shouldRenderTimelineSummary({
      displayMode: 'expanded',
      status: 'complete',
      isGenerating: true,
      summary: 'Located the project boundary.',
    })).toBe(true);
  });

  it('shows the final empty state only after generation ends', () => {
    expect(shouldRenderTimelineSummary({
      displayMode: 'expanded',
      status: 'complete',
      isGenerating: false,
    })).toBe(true);
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

describe('timeline card chrome', () => {
  it('uses flowchart intent and title when available', () => {
    const header = buildTimelineCardHeader({
      question: 'analyze auth middleware',
      flowchart: { intentKey: 'explore', nodeTitle: 'Auth Middleware Map' },
      contentColumns: 60,
      locale: 'en',
    });

    expect(header).toEqual({ badge: 'Explore', title: 'Auth Middleware Map' });
  });

  it('uses Task before summary flowchart exists', () => {
    const header = buildTimelineCardHeader({
      question: 'analyze auth middleware',
      contentColumns: 60,
      locale: 'en',
    });

    expect(header).toEqual({ badge: 'Task', title: 'analyze auth middleware' });
  });

  it('formats status, tool mix, and errors into one meta line', () => {
    expect(buildTimelineMetaLine({
      statusBadge: 'Done',
      toolCount: 6,
      errorCount: 1,
      toolSummary: 'Read×4 · Glob×1',
      wikiPersistLabel: 'wiki C001 saved',
    })).toBe('Done · 6 tools · Read×4 · Glob×1 · 1 errors · wiki C001 saved');
  });
});

describe('resolveQuestionBody', () => {
  it('returns full text when expanded', () => {
    const body = resolveQuestionBody({
      question: 'short',
      contentColumns: 40,
      expanded: true,
    });
    expect(body.text).toBe('short');
    expect(body.truncated).toBe(false);
  });

  it('folds long questions to preview lines', () => {
    const long = 'a'.repeat(200);
    const body = resolveQuestionBody({
      question: long,
      contentColumns: 20,
      expanded: false,
    });
    expect(body.truncated).toBe(true);
    expect(body.text.split('\n').length).toBeLessThanOrEqual(QUESTION_PREVIEW_MAX_LINES);
  });
});
