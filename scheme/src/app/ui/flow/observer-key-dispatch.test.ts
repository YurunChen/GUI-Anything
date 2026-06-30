import { describe, expect, test } from 'bun:test';
import { dispatchObserverKey, isHelpKey } from './observer-key-dispatch';

const baseState = {
  showHelp: false,
  showNotes: false,
  inspirationInputFocused: false,
  notifyAvailable: true,
  wikiAuditAvailable: true,
  htmlExportAvailable: true,
};

describe('dispatchObserverKey', () => {
  test('Esc does not quit when no overlay', () => {
    expect(dispatchObserverKey({ name: 'escape', ctrl: false, meta: false }, baseState)).toBeNull();
  });

  test('q and Ctrl+Q exit', () => {
    expect(dispatchObserverKey({ name: 'q', ctrl: false, meta: false }, baseState)?.type).toBe('exit');
    expect(dispatchObserverKey({ name: 'q', ctrl: true, meta: false }, baseState)?.type).toBe('exit');
  });

  test('Esc closes notes sidebar', () => {
    expect(
      dispatchObserverKey(
        { name: 'escape', ctrl: false, meta: false },
        { ...baseState, showNotes: true },
      )?.type,
    ).toBe('close_notes');
  });

  test('help mode blocks other keys', () => {
    expect(
      dispatchObserverKey(
        { name: 'g', ctrl: false, meta: false },
        { ...baseState, showHelp: true },
      ),
    ).toBeNull();
    expect(
      dispatchObserverKey(
        { name: 'escape', ctrl: false, meta: false },
        { ...baseState, showHelp: true },
      )?.type,
    ).toBe('close_help');
  });

  test('notes input only handles Esc', () => {
    expect(
      dispatchObserverKey(
        { name: 'g', ctrl: false, meta: false },
        { ...baseState, inspirationInputFocused: true },
      ),
    ).toBeNull();
    expect(
      dispatchObserverKey(
        { name: 'escape', ctrl: false, meta: false },
        { ...baseState, inspirationInputFocused: true },
      )?.type,
    ).toBe('close_notes_input');
  });

  test('s enables notify when available', () => {
    expect(dispatchObserverKey({ name: 's', ctrl: false, meta: false }, baseState)?.type).toBe('enable_notify');
    expect(dispatchObserverKey({ name: 'S', ctrl: false, meta: false, shift: true }, baseState)?.type).toBe('enable_notify');
    expect(dispatchObserverKey({ name: 's', ctrl: true, meta: false }, baseState)).toBeNull();
    expect(
      dispatchObserverKey(
        { name: 's', ctrl: false, meta: false },
        { ...baseState, notifyAvailable: false },
      ),
    ).toBeNull();
  });

  test('k files wiki audit when available', () => {
    expect(dispatchObserverKey({ name: 'k', ctrl: false, meta: false }, baseState)?.type).toBe('file_wiki_audit');
    expect(
      dispatchObserverKey(
        { name: 'k', ctrl: false, meta: false },
        { ...baseState, wikiAuditAvailable: false },
      ),
    ).toBeNull();
  });

  test('h opens HTML export when available', () => {
    expect(dispatchObserverKey({ name: 'h', ctrl: false, meta: false }, baseState)?.type).toBe('open_html');
    expect(
      dispatchObserverKey(
        { name: 'h', ctrl: false, meta: false },
        { ...baseState, htmlExportAvailable: false },
      ),
    ).toBeNull();
  });

  test('r regenerates HTML export when available', () => {
    expect(dispatchObserverKey({ name: 'r', ctrl: false, meta: false }, baseState)?.type).toBe('regenerate_html');
    expect(
      dispatchObserverKey(
        { name: 'r', ctrl: false, meta: false },
        { ...baseState, htmlExportAvailable: false },
      ),
    ).toBeNull();
  });

  test('e is not bound', () => {
    expect(dispatchObserverKey({ name: 'e', ctrl: false, meta: false }, baseState)).toBeNull();
  });

  test('b is not bound', () => {
    expect(dispatchObserverKey({ name: 'b', ctrl: false, meta: false }, baseState)).toBeNull();
  });

  test('Shift+J cycles morandi themes', () => {
    expect(dispatchObserverKey({ name: 'j', ctrl: false, meta: false, shift: true }, baseState))
      .toEqual({ type: 'theme', kind: 'morandi' });
  });

  test('help keys toggle overlay', () => {
    expect(isHelpKey({ name: '?', ctrl: false, meta: false })).toBe(true);
    expect(isHelpKey({ name: 'question', ctrl: false, meta: false })).toBe(true);
    expect(isHelpKey({ name: 'slash', ctrl: false, meta: false, shift: true })).toBe(true);
    expect(isHelpKey({ name: '/', ctrl: false, meta: false })).toBe(true);
    expect(isHelpKey({ name: '/', ctrl: false, meta: false, shift: true })).toBe(true);
    expect(dispatchObserverKey({ name: '?', ctrl: false, meta: false }, baseState)?.type).toBe('toggle_help');
    expect(dispatchObserverKey({ name: '/', ctrl: false, meta: false }, baseState)?.type).toBe('toggle_help');
    expect(dispatchObserverKey({ name: 'slash', ctrl: false, meta: false }, baseState)?.type).toBe('toggle_help');
    expect(dispatchObserverKey({ name: 'k', ctrl: true, meta: false }, baseState)?.type).toBe('toggle_help');
  });
});
