/**
 * Flow layout rhythm — single source for card chrome spacing (terminal cells).
 */
export const flowSpacing = {
  /** Gap between timeline cards */
  cardGap: 2,
  /** Inner padding of timeline cards */
  cardPadX: 2,
  cardPadY: 2,
  /** Blank line before labeled sections (Summary, Knowledge) */
  sectionGap: 1,
  /** Main scroll area horizontal padding */
  contentPadX: 1,
  /** Status bar / footer horizontal padding */
  chromePadX: 1,
  /** Vertical gap between Focus trail rows */
  graphNodeGap: 1,
  /** Flowchart rail depth indent (cells per level) */
  graphRailIndent: 3,
} as const;
