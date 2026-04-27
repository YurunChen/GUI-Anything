/**
 * Flow Observer constants
 * Centralized configuration for polling thresholds, layout, and UX tuning
 */

// Polling interval for session JSONL (ms)
export const OBSERVER_POLL_MS = 500;

// Wiki search similarity threshold (0-1)
export const WIKI_SEARCH_THRESHOLD = 0.90; // 90% similarity threshold

// Layout thresholds
export const COMPACT_LAYOUT_WIDTH = 110; // Terminal columns below this = compact mode

// Input box heights
export const INPUT_BOX_HEIGHT_DEFAULT = 6;
export const INPUT_BOX_HEIGHT_COMPACT = 4;

// Inspiration sidebar
export const INSPIRATION_SIDEBAR_WIDTH = 38;
export const INSPIRATION_MAX_RECENT = 6;

// File access heatmap
export const FILE_ACCESS_MAX_SHOW = 5;
export const FILE_ACCESS_WARN_THRESHOLD = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface ContextPanelLayout {
  isStacked: boolean;
  width: '100%' | `${number}%`;
  flexBasis: 'auto' | number;
  minWidth: '100%' | number;
  maxWidth: '100%' | number;
}

export function getContextPanelLayout(terminalWidth: number): ContextPanelLayout {
  const isStacked = terminalWidth < 96;
  if (isStacked) {
    return {
      isStacked: true,
      width: '100%',
      flexBasis: 'auto',
      minWidth: '100%',
      maxWidth: '100%',
    };
  }

  const ratio = terminalWidth < 140 ? 0.40 : 0.34;
  const panelCols = clamp(Math.floor(terminalWidth * ratio), 32, 52);
  const widthPercent = Math.round(ratio * 100) as 40 | 34;

  return {
    isStacked: false,
    width: `${widthPercent}%`,
    flexBasis: panelCols,
    minWidth: 32,
    maxWidth: 52,
  };
}

export interface NotesSectionLayout {
  listHeight: number;
  expandedItemHeight: number;
  maxItems: number;
}

export function getNotesSectionLayout(terminalHeight: number): NotesSectionLayout {
  // Reserve space for headers + capture input/status + padding.
  const available = Math.max(8, terminalHeight - 18);
  const listHeight = clamp(Math.floor(available * 0.65), 6, 12);
  const expandedItemHeight = clamp(Math.floor(available * 0.25), 2, 4);
  const maxItems = terminalHeight < 34 ? 4 : 6;
  return { listHeight, expandedItemHeight, maxItems };
}
