/**
 * observer-key-dispatch.ts — keyboard handling shared with footer/help availability rules.
 */

export interface ObserverKeyEvent {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift?: boolean;
}

export interface ObserverKeyState {
  showHelp: boolean;
  showNotes: boolean;
  inspirationInputFocused: boolean;
  notifyAvailable: boolean;
  wikiAuditAvailable: boolean;
  htmlExportAvailable: boolean;
}

export type ObserverKeyAction =
  | { type: 'exit' }
  | { type: 'close_help' }
  | { type: 'toggle_help' }
  | { type: 'close_notes_input' }
  | { type: 'toggle_notes' }
  | { type: 'close_notes' }
  | { type: 'toggle_calm' }
  | { type: 'toggle_question_expand' }
  | { type: 'toggle_mode' }
  | { type: 'send_snapshot' }
  | { type: 'file_wiki_audit' }
  | { type: 'open_html' }
  | { type: 'regenerate_html' }
  | { type: 'theme'; kind: 'morandi' | 'prev' | 'next' };

/** OpenTUI emits punctuation as literal chars (`/` `?`), not readline-style `slash`. */
function isSlashKeyName(name: string): boolean {
  return name === '/' || name === 'slash';
}

/** Plain `/` — OpenTUI parse.keypress sets `name` to the character itself. */
export function isPlainSlashKey(key: ObserverKeyEvent): boolean {
  return isSlashKeyName(key.name) && !key.shift && !key.ctrl && !key.meta;
}

/** `?` or Shift+/ (US layout). */
export function isQuestionMarkKey(key: ObserverKeyEvent): boolean {
  return key.name === '?' || key.name === 'question'
    || (isSlashKeyName(key.name) && !!key.shift);
}

export function isHelpKey(key: ObserverKeyEvent): boolean {
  if (key.name === 'f1') return true;
  if (key.ctrl && isSlashKeyName(key.name)) return true;
  if (key.ctrl && (key.name === 'k' || key.name === 'K')) return true;
  return isPlainSlashKey(key) || isQuestionMarkKey(key);
}

export function dispatchObserverKey(
  key: ObserverKeyEvent,
  state: ObserverKeyState,
): ObserverKeyAction | null {
  if (key.ctrl && key.name === 'q') {
    return { type: 'exit' };
  }

  if (state.showHelp) {
    if (key.name === 'escape' || isHelpKey(key)) {
      return { type: 'close_help' };
    }
    return null;
  }

  if (state.inspirationInputFocused) {
    if (key.name === 'escape') {
      return { type: 'close_notes_input' };
    }
    return null;
  }

  if (isHelpKey(key)) {
    return { type: 'toggle_help' };
  }

  if (key.name === 'i') {
    return { type: 'toggle_notes' };
  }

  if (key.name === 'escape') {
    if (state.showNotes) {
      return { type: 'close_notes' };
    }
    return null;
  }

  if (key.name === 'c' && !key.ctrl && !key.meta) {
    return { type: 'toggle_calm' };
  }

  if (key.name === 'e' && !key.ctrl && !key.meta) {
    return { type: 'toggle_question_expand' };
  }

  if (key.name === 'q') {
    return { type: 'exit' };
  }

  if (key.name === 'g' && !key.shift) {
    return { type: 'toggle_mode' };
  }

  if (key.name === 's' && state.notifyAvailable) {
    return { type: 'send_snapshot' };
  }

  if (key.name === 'k' && !key.ctrl && !key.meta && state.wikiAuditAvailable) {
    return { type: 'file_wiki_audit' };
  }

  if (key.name === 'h' && !key.ctrl && !key.meta && state.htmlExportAvailable) {
    return { type: 'open_html' };
  }

  if (state.htmlExportAvailable && !key.ctrl && !key.meta && !key.shift) {
    if (key.name === 'r') {
      return { type: 'regenerate_html' };
    }
  }

  const isMorandiKey = key.name === 'J' || (key.name === 'j' && key.shift);
  const isPrevThemeKey = key.name === '[' || key.name === 'leftbracket';
  const isNextThemeKey = key.name === ']' || key.name === 'rightbracket';
  if (isMorandiKey) return { type: 'theme', kind: 'morandi' };
  if (isPrevThemeKey) return { type: 'theme', kind: 'prev' };
  if (isNextThemeKey) return { type: 'theme', kind: 'next' };

  return null;
}
