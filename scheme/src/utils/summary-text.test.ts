import { describe, expect, it } from 'bun:test';
import { formatSummaryForTui } from './summary-text';

describe('formatSummaryForTui', () => {
  it('collapses repeated whitespace', () => {
    expect(formatSummaryForTui('a   b\t\tc')).toBe('a b c');
  });

  it('joins latin words split by hard wraps', () => {
    expect(formatSummaryForTui('你向 Cla\nude Code 打招呼')).toBe('你向 Claude Code 打招呼');
  });

  it('adds spacing on Chinese-English boundaries', () => {
    expect(formatSummaryForTui('你好Claude')).toBe('你好 Claude');
    expect(formatSummaryForTui('Claude你好')).toBe('Claude 你好');
  });

  it('keeps punctuation and normal sentence flow', () => {
    expect(formatSummaryForTui('你打了个招呼，Claude Code回应。')).toBe('你打了个招呼，Claude Code 回应。');
  });
});

