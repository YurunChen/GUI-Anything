import { describe, expect, it } from 'bun:test';
import { resolveIntentTitleBudget, resolveStatusBarIntentDisplay } from './ObserverStatusBar';

/** Short session label from jsonl path (e.g. `8ab6a37d…`). */
function formatSessionShort(sessionPath: string, maxWidth = 14): string {
  const base = sessionPath.split('/').slice(-1)[0] || sessionPath;
  const id = base.replace(/\.jsonl$/i, '');
  if (id.length <= maxWidth) return id;
  const head = Math.min(8, maxWidth - 1);
  return `${id.slice(0, head)}…`;
}

describe('formatSessionShort', () => {
  it('strips jsonl suffix and truncates long uuids', () => {
    const path = '/Users/me/.claude/projects/foo/8ab6a37d-e53b-48e3-b19c-0123456789ab.jsonl';
    expect(formatSessionShort(path, 10)).toBe('8ab6a37d…');
    expect(formatSessionShort(path, 40)).toBe('8ab6a37d-e53b-48e3-b19c-0123456789ab');
  });

  it('returns placeholder-friendly short ids unchanged', () => {
    expect(formatSessionShort('/tmp/abc.jsonl', 12)).toBe('abc');
  });
});

describe('resolveIntentTitleBudget', () => {
  it('reserves only the intent badge chrome', () => {
    expect(resolveIntentTitleBudget({
      contentWidth: 96,
      badgeLength: 'Design'.length,
    })).toBe(96 - 'Design'.length - 6);
  });

  it('keeps the minimum title budget for narrow panes', () => {
    expect(resolveIntentTitleBudget({
      contentWidth: 24,
      badgeLength: 'Explore'.length,
    })).toBe(20);
  });
});

describe('resolveStatusBarIntentDisplay', () => {
  it('uses an idle placeholder when no live intent exists', () => {
    expect(resolveStatusBarIntentDisplay({
      locale: 'en',
      idleTitle: 'Awaiting task',
    })).toEqual({ badge: null, title: 'Awaiting task', isIdle: true });
  });

  it('keeps real intent display when live intent exists', () => {
    expect(resolveStatusBarIntentDisplay({
      liveIntent: { intentKey: 'project_design', title: '分析架构' },
      locale: 'zh-Hans',
      idleTitle: '待具体任务',
    })).toEqual({ badge: '项目与设计', title: '分析架构', isIdle: false });
  });
});
