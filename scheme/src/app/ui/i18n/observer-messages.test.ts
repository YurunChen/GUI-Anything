import { describe, expect, it } from 'bun:test';
import { getObserverMessages, resolveObserverLocale } from './observer-messages';

describe('observer i18n', () => {
  it('defaults to English', () => {
    expect(resolveObserverLocale('en')).toBe('en');
    expect(getObserverMessages('en').summary).toBe('Summary');
  });

  it('resolves Chinese locale variants', () => {
    expect(resolveObserverLocale('zh-CN')).toBe('zh-Hans');
    expect(getObserverMessages('zh-Hans').summary).toBe('摘要');
    expect(getObserverMessages('en').summary).toBe('Summary');
  });

  it('provides summary fallback strings in both locales', () => {
    const en = getObserverMessages('en');
    const zh = getObserverMessages('zh-Hans');
    expect(en.calmNoSummary).toContain('round');
    expect(zh.calmNoSummary).toContain('本轮');
    expect(en.excerptWithOutput('q', 1, 'out', 0)).toContain('tool');
    expect(zh.excerptWithOutput('q', 1, 'out', 0)).toContain('工具调用');
  });
});
