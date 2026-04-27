/**
 * Summary layout utilities - 文本布局计算工具
 * 被 SummaryPanel 和测试共享
 */

/** 字符显示宽度：CJK 字符算 2 个宽度 */
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

/** 计算整行的显示宽度 */
export function lineDisplayWidth(line: string): number {
  let width = 0;
  for (const ch of line) {
    width += charDisplayWidth(ch);
  }
  return width;
}

/** 计算 summary 文本可用列数 */
export function summaryTextColumns(availableWidth: number): number {
  // Parent row + scrollbox padding + summary box padding + left border.
  const RESERVED_COLUMNS = 8;
  return Math.max(20, availableWidth - RESERVED_COLUMNS);
}

/** 文本折行计算 */
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

/** 计算 textarea 需要的高度 */
export function summaryTextareaHeight(value: string, availableWidth: number): number {
  return wrapDisplayLines(value, summaryTextColumns(availableWidth)).length;
}
