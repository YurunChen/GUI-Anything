/**
 * ABOUTME: Display-safe formatting for flow summary text in TUI.
 */

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Fixes hard wraps inside latin words, then normalizes spacing for stable TUI wrapping.
 */
export function formatSummaryForTui(raw: string): string {
  return collapseWhitespace(
    raw
      .replace(/([A-Za-z])\s*\n\s*([A-Za-z])/g, '$1$2')
      .replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, '$1 $2')
      .replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, '$1 $2')
  );
}

