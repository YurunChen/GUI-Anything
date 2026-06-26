import { describe, expect, test } from 'bun:test';
import {
  buildFooterHotkeyBody,
  buildObserverHotkeyHints,
  formatFooterHotkeyLines,
  nextObserverViewMode,
  type ObserverHotkeyContext,
} from './observer-hotkeys';

const base: ObserverHotkeyContext = {
  footerMode: 'default',
  observerMode: 'timeline',
  calmMode: false,
  notifyAvailable: true,
  wikiAuditAvailable: true,
  htmlExportAvailable: true,
};

describe('buildObserverHotkeyHints', () => {
  test('default mode includes mode switch, notes, calm, help, theme, notify, quit', () => {
    const ids = buildObserverHotkeyHints(base).map((h) => h.id);
    expect(ids).not.toContain('move');
    expect(ids).not.toContain('latest');
    expect(ids).toContain('mode');
    expect(ids).toContain('notes');
    expect(ids).toContain('calm');
    expect(ids).toContain('help');
    expect(ids).toContain('theme');
    expect(ids).toContain('notify');
    expect(ids).toContain('html-export');
    expect(ids).toContain('quit');
    expect(ids).toContain('question');
  });

  test('question expand is only advertised in timeline mode', () => {
    expect(buildObserverHotkeyHints({ ...base, observerMode: 'timeline' }).map((h) => h.id))
      .toContain('question');
    expect(buildObserverHotkeyHints({ ...base, observerMode: 'focus' }).map((h) => h.id))
      .not.toContain('question');
    expect(buildObserverHotkeyHints({ ...base, observerMode: 'workspace' }).map((h) => h.id))
      .not.toContain('question');
  });

  test('notify hidden when unavailable', () => {
    const ids = buildObserverHotkeyHints({ ...base, notifyAvailable: false }).map((h) => h.id);
    expect(ids).not.toContain('notify');
  });

  test('HTML export hidden when unavailable', () => {
    const ids = buildObserverHotkeyHints({ ...base, htmlExportAvailable: false }).map((h) => h.id);
    expect(ids).not.toContain('html-export');
  });
});

describe('nextObserverViewMode', () => {
  test('cycles timeline, focus, and workspace', () => {
    expect(nextObserverViewMode('timeline')).toBe('focus');
    expect(nextObserverViewMode('focus')).toBe('workspace');
    expect(nextObserverViewMode('workspace')).toBe('timeline');
  });
});

describe('formatFooterHotkeyLines', () => {
  test('splits hints across two rows', () => {
    const hints = buildObserverHotkeyHints(base);
    const { line1, line2 } = formatFooterHotkeyLines(hints, false, 200);
    expect(line1).toContain('g → View');
    expect(line1).not.toContain('Focus');
    expect(line1).not.toContain('Timeline');
    expect(line1).toContain('? / F1 / Ctrl+/ / Ctrl-K help');
    expect(line1).not.toContain('?:help');
    expect(line2).toContain('theme');
  });

  test('uses compact help label when footer is narrow', () => {
    const hints = buildObserverHotkeyHints(base);
    const { line1 } = formatFooterHotkeyLines(hints, true, 56);
    expect(line1).toContain('? / help');
    expect(line1).not.toContain('?:help');
  });
});

describe('buildFooterHotkeyBody', () => {
  test('joins lines with newline for one text node', () => {
    expect(buildFooterHotkeyBody({ line1: 'g → View', line2: 'q quit' })).toBe(
      'g → View\nq quit',
    );
  });
});
