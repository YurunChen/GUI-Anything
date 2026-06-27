/**
 * observer-hotkeys.ts — single source of truth for footer + help shortcut labels.
 * Only hints that are actually handled in FlowObserverShell are listed here.
 */

import { getObserverMessages, type ObserverMessages } from '../i18n/observer-messages';
import { lineDisplayWidth, truncateFlowText } from '../../../utils/flow-text';

export type ObserverFooterMode = 'default' | 'notes' | 'notes-input';

export interface ObserverHotkeyContext {
  footerMode: ObserverFooterMode;
  observerMode: 'exploration' | 'flowchart';
  calmMode: boolean;
  /** `s` is wired and notification service is enabled. */
  notifyAvailable: boolean;
  /** `k` files audit for latest KNOWLEDGE hit. */
  wikiAuditAvailable: boolean;
  /** `e` exports/opens project evolution HTML. */
  exportAvailable: boolean;
}

export interface HotkeyHint {
  id: string;
  row: 1 | 2;
  order: number;
  full: string;
  short: string;
}

export function buildObserverHotkeyHints(ctx: ObserverHotkeyContext): HotkeyHint[] {
  const m = getObserverMessages();

  if (ctx.footerMode === 'notes-input') {
    return [
      hint('save', 1, 0, m.cmdNotesSave, m.cmdNotesSaveShort),
      hint('esc-input', 1, 1, m.cmdNotesEscInput, m.cmdNotesEscInputShort),
      hint('close-notes', 2, 0, m.cmdNotesClose, m.cmdNotesCloseShort),
    ];
  }

  if (ctx.footerMode === 'notes') {
    return [
      ...navHints(ctx, m, 1, 0),
      hint('notes', 1, 10, m.cmdNotesClose, m.cmdNotesCloseShort),
      hint('help', 1, 11, m.cmdHelpOpen, m.cmdHelpOpenShort),
      hint('calm', 1, 12, calmLabel(ctx, m), calmLabelShort(ctx, m)),
      ...appearanceHints(m, 2, 0),
      ...sessionHints(ctx, m, 2, 10),
    ];
  }

  return [
    ...navHints(ctx, m, 1, 0),
    hint('notes', 1, 10, m.cmdNotes, m.cmdNotesShort),
    hint('calm', 1, 11, calmLabel(ctx, m), calmLabelShort(ctx, m)),
    hint('help', 1, 12, m.cmdHelpOpen, m.cmdHelpOpenShort),
    ...appearanceHints(m, 2, 0),
    ...sessionHints(ctx, m, 2, 10),
  ];
}

function navHints(ctx: ObserverHotkeyContext, m: ObserverMessages, row: 1 | 2, baseOrder: number): HotkeyHint[] {
  const nextMode = ctx.observerMode === 'exploration' ? m.modeFlowchart : m.modeTimeline;
  return [
    hint('mode', row, baseOrder, m.cmdSwitchMode(nextMode), m.cmdSwitchModeShort(nextMode)),
  ];
}

function appearanceHints(m: ObserverMessages, row: 1 | 2, baseOrder: number): HotkeyHint[] {
  return [
    hint('theme', row, baseOrder, m.cmdTheme, m.cmdThemeShort),
  ];
}

function sessionHints(ctx: ObserverHotkeyContext, m: ObserverMessages, row: 1 | 2, baseOrder: number): HotkeyHint[] {
  const out: HotkeyHint[] = [];
  let order = baseOrder;

  if (ctx.notifyAvailable) {
    out.push(hint('notify', row, order++, m.cmdNotify, m.cmdNotifyShort));
  }
  if (ctx.wikiAuditAvailable) {
    out.push(hint('wiki-audit', row, order++, m.cmdWikiAudit, m.cmdWikiAuditShort));
  }
  if (ctx.exportAvailable) {
    out.push(hint('export', row, order++, m.cmdExport, m.cmdExportShort));
  }
  out.push(
    hint('quit', row, order++, quitLabel(ctx, m), quitLabelShort(ctx, m)),
    hint('ctrl-quit', row, order++, m.cmdCtrlQuit, m.cmdCtrlQuitShort),
  );
  return out;
}

function hint(
  id: string,
  row: 1 | 2,
  order: number,
  full: string,
  short: string,
): HotkeyHint {
  return { id, row, order, full, short };
}

function calmLabel(ctx: ObserverHotkeyContext, m: ObserverMessages): string {
  return ctx.calmMode ? m.cmdCalmOn : m.cmdCalmOff;
}

function calmLabelShort(ctx: ObserverHotkeyContext, m: ObserverMessages): string {
  return ctx.calmMode ? m.cmdCalmOnShort : m.cmdCalmOffShort;
}

function quitLabel(ctx: ObserverHotkeyContext, m: ObserverMessages): string {
  return ctx.footerMode === 'notes' ? m.cmdQuitNotes : m.cmdQuitDefault;
}

function quitLabelShort(ctx: ObserverHotkeyContext, m: ObserverMessages): string {
  return ctx.footerMode === 'notes' ? m.cmdQuitNotesShort : m.cmdQuitDefaultShort;
}

export interface FooterHotkeyLines {
  line1: string;
  line2: string;
}

/** Single string for CommandBar — one <text> node avoids OpenTUI row overlap in narrow panes. */
export function buildFooterHotkeyBody(lines: FooterHotkeyLines): string {
  return [lines.line1, lines.line2].filter((line) => line.length > 0).join('\n');
}

/** Two-line footer (WeChat-reminder style): row 1 = nav/session, row 2 = theme/quit. */
export function formatFooterHotkeyLines(
  hints: HotkeyHint[],
  compact: boolean,
  maxWidth: number,
): FooterHotkeyLines {
  const sep = compact ? ' · ' : '  ';
  const line1 = joinHintLine(hints.filter((h) => h.row === 1), compact, sep, maxWidth);
  const line2 = joinHintLine(hints.filter((h) => h.row === 2), compact, sep, maxWidth);
  return { line1, line2 };
}

function joinHintLine(
  hints: HotkeyHint[],
  compact: boolean,
  sep: string,
  maxWidth: number,
): string {
  const sorted = [...hints].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return '';

  const fullParts = sorted.map((h) => h.full);
  const shortParts = sorted.map((h) => h.short);

  const fullLine = fullParts.join(sep);
  if (lineDisplayWidth(fullLine) <= maxWidth) return fullLine;

  const shortLine = shortParts.join(sep);
  if (lineDisplayWidth(shortLine) <= maxWidth || compact) {
    return lineDisplayWidth(shortLine) <= maxWidth ? shortLine : trimHintLine(shortParts, sep, maxWidth);
  }

  return trimHintLine(fullParts, sep, maxWidth);
}

// Width is measured in terminal columns (CJK glyphs are 2 cols), not JS string
// length, so Chinese footer labels don't overflow the pane.
function trimHintLine(parts: string[], sep: string, maxWidth: number): string {
  let line = parts[0] ?? '';
  for (let i = 1; i < parts.length; i++) {
    const candidate = `${line}${sep}${parts[i]}`;
    if (lineDisplayWidth(candidate) > maxWidth) break;
    line = candidate;
  }
  if (lineDisplayWidth(line) > maxWidth) {
    return truncateFlowText(line, maxWidth);
  }
  return line;
}

/** Help overlay lines derived from the same availability rules as the footer. */
export function buildHelpLinesFromHotkeys(ctx: ObserverHotkeyContext): string[] {
  const m = getObserverMessages();
  const hints = buildObserverHotkeyHints(ctx);
  const byId = new Map(hints.map((h) => [h.id, h]));

  const lines: string[] = [m.navSection, m.helpPaneFocus];

  if (byId.has('mode')) {
    lines.push(m.helpKeyMode);
  }
  if (byId.has('notes')) {
    lines.push(
      ctx.footerMode === 'notes' || ctx.footerMode === 'notes-input'
        ? m.helpKeyNotesClose
        : m.helpKeyNotesOpen,
    );
  }
  if (byId.has('calm')) {
    lines.push(ctx.calmMode ? m.helpKeyCalmDisable : m.helpKeyCalmEnable);
  }

  if (ctx.footerMode === 'notes-input') {
    lines.push(m.helpKeyEnterNote, m.helpKeyEscNoteInput);
  }

  lines.push('', m.sessionSection);
  if (byId.has('notify')) {
    lines.push(m.helpKeyNotify);
  }
  if (byId.has('wiki-audit')) {
    lines.push(m.helpKeyWikiAudit);
  }
  if (byId.has('export')) {
    lines.push(m.helpKeyExport, m.helpKeyRegen);
  }
  lines.push(ctx.footerMode === 'notes' || ctx.footerMode === 'notes-input'
    ? m.helpKeyQuitNotes
    : m.helpKeyQuitDefault);

  lines.push('', m.appearanceSection);
  lines.push(m.helpKeyThemeBracket, m.helpKeyThemeMorandi);

  lines.push('', m.displaySection);
  lines.push(ctx.calmMode ? m.helpCalmOnHint : m.helpCalmOffHint);

  lines.push('', m.helpSection);
  lines.push(m.helpKeyHelpToggle, m.helpKeyHelpSlash);

  return lines;
}
