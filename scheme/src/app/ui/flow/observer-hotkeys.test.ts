import { describe, expect, test } from 'bun:test';
import {
  buildFooterHotkeyBody,
  buildObserverHotkeyHints,
  formatFooterHotkeyLines,
  type ObserverHotkeyContext,
} from './observer-hotkeys';

const base: ObserverHotkeyContext = {
  footerMode: 'default',
  observerMode: 'exploration',
  calmMode: false,
  notifyAvailable: true,
  wikiAuditAvailable: true,
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
    expect(ids).toContain('quit');
  });

  test('notify hidden when unavailable', () => {
    const ids = buildObserverHotkeyHints({ ...base, notifyAvailable: false }).map((h) => h.id);
    expect(ids).not.toContain('notify');
  });
});

describe('formatFooterHotkeyLines', () => {
  test('splits hints across two rows', () => {
    const hints = buildObserverHotkeyHints(base);
    const { line1, line2 } = formatFooterHotkeyLines(hints, false, 200);
    expect(line1).toContain('flowchart');
    expect(line1).toContain('? / F1 / Ctrl+/ / Ctrl-K help');
    expect(line1).not.toContain('?:help');
    expect(line2).toContain('theme');
  });

  test('uses compact help label when footer is narrow', () => {
    const hints = buildObserverHotkeyHints(base);
    const { line1 } = formatFooterHotkeyLines(hints, true, 80);
    expect(line1).toContain('? / help');
    expect(line1).not.toContain('?:help');
  });
});

describe('buildFooterHotkeyBody', () => {
  test('joins lines with newline for one text node', () => {
    expect(buildFooterHotkeyBody({ line1: 'g → flowchart', line2: 'q quit' })).toBe(
      'g → flowchart\nq quit',
    );
  });
});
