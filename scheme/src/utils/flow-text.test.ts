import { describe, expect, it } from 'bun:test';
import {
  formatFlowText,
  foldFlowTextPreview,
  formatSummaryForTui,
  lineDisplayWidth,
  truncateFlowText,
} from './flow-text';

describe('formatFlowText', () => {
  it('collapses repeated whitespace', () => {
    expect(formatFlowText('a   b\t\tc')).toBe('a b c');
  });

  it('joins latin words split by hard wraps', () => {
    expect(formatFlowText('你向 Cla\nude Code 打招呼')).toBe('你向 Claude Code 打招呼');
  });

  it('adds spacing on Chinese-English boundaries', () => {
    expect(formatFlowText('你好Claude')).toBe('你好 Claude');
    expect(formatFlowText('Claude你好')).toBe('Claude 你好');
  });

  it('keeps punctuation and normal sentence flow', () => {
    expect(formatFlowText('你打了个招呼，Claude Code回应。')).toBe('你打了个招呼，Claude Code 回应。');
  });

  it('aliases formatSummaryForTui', () => {
    expect(formatSummaryForTui('你好Claude')).toBe(formatFlowText('你好Claude'));
  });
});

describe('truncateFlowText', () => {
  it('truncates by display width for CJK', () => {
    expect(lineDisplayWidth('方案')).toBe(4);
    expect(truncateFlowText('项目方案评审', 7)).toBe('项目方…');
  });

  it('truncates mixed CJK and Latin', () => {
    const cut = truncateFlowText('终端 UI 架构', 10);
    expect(lineDisplayWidth(cut)).toBeLessThanOrEqual(10);
    expect(cut.endsWith('…')).toBe(true);
  });
});

describe('foldFlowTextPreview', () => {
  it('keeps short text without truncation', () => {
    const { text, truncated } = foldFlowTextPreview('hello', 40, 3);
    expect(truncated).toBe(false);
    expect(text).toBe('hello');
  });

  it('folds to max lines with ellipsis on overflow', () => {
    const long = 'word '.repeat(40).trim();
    const { text, truncated } = foldFlowTextPreview(long, 12, 3);
    expect(truncated).toBe(true);
    expect(text.split('\n').length).toBe(3);
    expect(text.endsWith('…')).toBe(true);
  });
});
