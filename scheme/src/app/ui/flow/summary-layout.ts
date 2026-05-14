/**
 * Summary layout utilities - text layout helpers.
 * Shared by `SummaryPanel` and tests.
 */

/** Character display width: CJK chars count as width 2. */
export function charDisplayWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0xa4cf) || // CJK
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility
    (code >= 0xfe10 && code <= 0xfe6f) || // Vertical Forms
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth
    (code >= 0xffe0 && code <= 0xffe6)    // Fullwidth Symbols
  ) {
    return 2;
  }
  return 1;
}

/** Calculate display width of one line. */
export function lineDisplayWidth(line: string): number {
  let width = 0;
  for (const ch of line) {
    width += charDisplayWidth(ch);
  }
  return width;
}

/** Calculate available columns for summary text. */
export function summaryTextColumns(availableWidth: number): number {
  // Parent row + scrollbox padding + summary box padding + left border.
  const RESERVED_COLUMNS = 8;
  return Math.max(20, availableWidth - RESERVED_COLUMNS);
}

/** Wrap text by display width. */
export function wrapDisplayLines(value: string, columns: number): string[] {
  const safeColumns = Math.max(1, columns);
  const output: string[] = [];

  for (const sourceLine of value.split(/\r?\n/)) {
    if (sourceLine.length === 0) {
      output.push('');
      continue;
    }

    let current = '';
    let currentWidth = 0;
    for (const ch of sourceLine) {
      const width = charDisplayWidth(ch);
      if (current && currentWidth + width > safeColumns) {
        output.push(current);
        current = ch;
        currentWidth = width;
        continue;
      }
      current += ch;
      currentWidth += width;
    }
    output.push(current);
  }

  return output.length > 0 ? output : [''];
}

/** Calculate textarea height. */
export function summaryTextareaHeight(value: string, availableWidth: number): number {
  return wrapDisplayLines(value, summaryTextColumns(availableWidth)).length;
}
