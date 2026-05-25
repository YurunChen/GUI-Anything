import { describe, expect, it } from 'bun:test';
import { finalizeExplorationSummaryItem, finalizeSummaryFromTimelineOnly } from './summary-display';

describe('summary-display', () => {
  it('uses calm text on validation failure without error suffix', () => {
    const out = finalizeExplorationSummaryItem({
      question: 'hello',
      nodes: [{
        id: 'n1',
        timestamp: 1,
        type: 'response',
        label: 'Hi there',
      }],
      payload: {
        displaySummary: '',
        persist: null,
        validationError: 'missing_summary',
      },
    });
    expect(out.text).toBe('Hi there');
    expect(out.text).not.toContain('格式异常');
    expect(out.persistMeta?.reason).toBe('skip');
  });

  it('timeline-only after agent failure is ready excerpt', () => {
    const out = finalizeSummaryFromTimelineOnly({
      question: 'fix bug',
      nodes: [{
        id: 'n1',
        timestamp: 1,
        type: 'tool',
        label: 'Read x',
      }],
      errorReason: 'always-fail',
    });
    expect(out.status).toBe('ready');
    expect(out.source).toBe('ai');
  });
});
