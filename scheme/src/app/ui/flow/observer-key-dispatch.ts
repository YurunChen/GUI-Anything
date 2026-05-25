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
}

export type ObserverKeyAction =
  | { type: 'exit' }
  | { type: 'close_help' }
  | { type: 'toggle_help' }
  | { type: 'close_notes_input' }
  | { type: 'toggle_notes' }
  | { type: 'close_notes' }
  | { type: 'toggle_calm' }
  | { type: 'toggle_mode' }
  | { type: 'send_snapshot' }
  | { type: 'file_wiki_audit' }
  | { type: 'theme'; kind: 'morandi' | 'prev' | 'next' };

export function isHelpKey(key: ObserverKeyEvent): boolean {
  if (key.name === 'f1') return true;
  if (key.ctrl && (key.name === 'slash' || key.name === '/')) return true;
  return key.name === '?' || key.name === 'question' || (key.name === 'slash' && !!key.shift);
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

  if (key.name === 'slash' && !key.shift) {
    return { type: 'toggle_help' };
  }

  if (key.ctrl && (key.name === 'k' || key.name === 'K')) {
    return { type: 'toggle_help' };
  }

  if (key.name === 'c' && !key.ctrl && !key.meta) {
    return { type: 'toggle_calm' };
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

  const isMorandiKey = key.name === 'J' || (key.name === 'j' && key.shift);
  const isPrevThemeKey = key.name === '[' || key.name === 'leftbracket';
  const isNextThemeKey = key.name === ']' || key.name === 'rightbracket';
  if (isMorandiKey) return { type: 'theme', kind: 'morandi' };
  if (isPrevThemeKey) return { type: 'theme', kind: 'prev' };
  if (isNextThemeKey) return { type: 'theme', kind: 'next' };

  return null;
}
