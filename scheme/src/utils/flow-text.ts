/**
 * Unified mixed Chinese / English text handling for Flow TUI.
 * - Display width via `string-width` (unicode-width semantics for terminals)
 * - Normalization before OpenTUI native wrap (FlowTextBlock)
 */

import stringWidth from 'string-width';

/** Character display width in terminal columns (CJK / fullwidth → 2). */
export function charDisplayWidth(ch: string): number {
  if (!ch) return 0;
  const width = stringWidth(ch);
  return width > 0 ? width : 1;
}

export function lineDisplayWidth(line: string): number {
  return stringWidth(line);
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize user-facing prose for TUI: collapse whitespace, repair hard wraps,
 * and insert spaces at CJK ↔ Latin boundaries.
 */
export function formatFlowText(raw: string): string {
  if (!raw) return '';
  return collapseWhitespace(
    raw
      .replace(/([A-Za-z])\s*\n\s*([A-Za-z])/g, '$1$2')
      .replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, '$1 $2')
      .replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, '$1 $2'),
  );
}

/** @deprecated Use `formatFlowText`. */
export const formatSummaryForTui = formatFlowText;

/** Truncate by terminal display columns (not JS string length). */
export function truncateFlowText(text: string, maxCols: number, ellipsis = '…'): string {
  if (maxCols <= 0) return '';
  if (lineDisplayWidth(text) <= maxCols) return text;

  const ellipsisWidth = lineDisplayWidth(ellipsis);
  const budget = Math.max(1, maxCols - ellipsisWidth);
  let out = '';
  let width = 0;

  for (const ch of text) {
    const chWidth = charDisplayWidth(ch);
    if (width + chWidth > budget) {
      return `${out}${ellipsis}`;
    }
    out += ch;
    width += chWidth;
  }
  return out;
}
