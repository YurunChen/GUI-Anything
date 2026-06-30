import { describe, expect, test } from 'bun:test';

// Footer labels are localized; pin to English so assertions are locale-stable
// regardless of the dev machine's LANG (resolveObserverLocale reads FLOW_LOCALE first).
process.env.FLOW_LOCALE = 'en';

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
    const hints = buildObserverHotkeyHints(base);
    const ids = hints.map((h) => h.id);
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
    expect(ids).not.toContain('question');
    expect(hints.find((h) => h.id === 'mode')?.full).toBe('g → Focus');
  });

  test('mode hint names the next view', () => {
    expect(buildObserverHotkeyHints({ ...base, observerMode: 'focus' }).find((h) => h.id === 'mode')?.full)
      .toBe('g → Workspace');
    expect(buildObserverHotkeyHints({ ...base, observerMode: 'workspace' }).find((h) => h.id === 'mode')?.full)
      .toBe('g → Timeline');
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
    expect(line1).toContain('g → Focus');
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

  test('does not include personality content in the hotkey body', () => {
    expect(buildFooterHotkeyBody({
      line1: 'g → View',
      line2: 'q quit',
    })).not.toContain('Personality');
  });
});
