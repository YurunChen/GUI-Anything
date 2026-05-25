/**
 * Flow Observer constants
 * Centralized configuration for polling thresholds, layout, and UX tuning
 */

// Polling interval for session JSONL (ms)
export const OBSERVER_POLL_MS = 500;

// Wiki search similarity threshold (0-1)
// Lowered to 0.5 to allow more flexible keyword matching
export const WIKI_SEARCH_THRESHOLD = 0.5; // 50% similarity threshold

// Layout thresholds
export const COMPACT_LAYOUT_WIDTH = 110; // Terminal columns below this = compact mode

// Input box heights
export const INPUT_BOX_HEIGHT_DEFAULT = 6;
export const INPUT_BOX_HEIGHT_COMPACT = 4;

// Inspiration notes sidebar
export const INSPIRATION_MAX_RECENT = 6;

// File access heatmap
export const FILE_ACCESS_MAX_SHOW = 5;
export const FILE_ACCESS_WARN_THRESHOLD = 3;

export interface NotesSectionLayout {
  listHeight: number;
  expandedItemHeight: number;
  maxItems: number;
}

/** Right sidebar width when notes panel is open (CodeWhale-style split). */
export const NOTES_SIDEBAR_MIN_COLS = 24;
export const NOTES_SIDEBAR_MAX_COLS = 42;
export const NOTES_SIDEBAR_RATIO = 0.36;

const NOTES_SIDEBAR_MIN_MAIN_COLS = 28;

/** Minimum terminal columns to open the notes sidebar (main + sidebar). */
export const NOTES_SIDEBAR_MIN_TERMINAL_COLS = NOTES_SIDEBAR_MIN_COLS + NOTES_SIDEBAR_MIN_MAIN_COLS;

export function resolveNotesSidebarWidth(terminalCols: number): number {
  if (terminalCols < NOTES_SIDEBAR_MIN_TERMINAL_COLS) return 0;
  const byRatio = Math.floor(terminalCols * NOTES_SIDEBAR_RATIO);
  const desired = Math.min(NOTES_SIDEBAR_MAX_COLS, Math.max(NOTES_SIDEBAR_MIN_COLS, byRatio));
  return Math.min(desired, terminalCols - NOTES_SIDEBAR_MIN_MAIN_COLS);
}

export function getNotesSectionLayout(terminalHeight: number): NotesSectionLayout {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  // Reserve space for headers + capture input/status + padding.
  const available = Math.max(8, terminalHeight - 18);
  const listHeight = clamp(Math.floor(available * 0.65), 6, 12);
  const expandedItemHeight = clamp(Math.floor(available * 0.25), 2, 4);
  const maxItems = terminalHeight < 34 ? 4 : 6;
  return { listHeight, expandedItemHeight, maxItems };
}
