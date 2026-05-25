import { describe, expect, it } from 'bun:test';
import { resolveIntentChromeDisplay } from './intent-chrome-display';

describe('resolveIntentChromeDisplay', () => {
  it('hides badge for greeting and keeps idle title', () => {
    const view = resolveIntentChromeDisplay({
      intentKey: 'greeting',
      title: 'Awaiting task',
      locale: 'en',
      idleTitle: 'Awaiting task',
    });
    expect(view).toEqual({ badge: null, title: 'Awaiting task', isIdle: true });
  });

  it('shows localized badge and title for task intents', () => {
    const view = resolveIntentChromeDisplay({
      intentKey: 'project_design',
      title: 'Analyze repo layout',
      locale: 'en',
      idleTitle: 'Awaiting task',
    });
    expect(view.badge).toBe('Design');
    expect(view.title).toBe('Analyze repo layout');
    expect(view.isIdle).toBe(false);
  });

  it('uses zh-Hans badge labels', () => {
    const view = resolveIntentChromeDisplay({
      intentKey: 'implement',
      title: '优化 status bar',
      locale: 'zh-Hans',
      idleTitle: '待具体任务',
    });
    expect(view.badge).toBe('实现功能');
    expect(view.title).toBe('优化 status bar');
  });
});
