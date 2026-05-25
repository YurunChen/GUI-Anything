import type { Exploration } from '../../../data/protocol/observer-protocol';

export interface TimelineEntry {
  exploration: Exploration;
  originalIndex: number;
}

export function sortTimelineEntries(explorations: Exploration[]): TimelineEntry[] {
  return explorations
    .map((exploration, originalIndex) => ({ exploration, originalIndex }))
    .sort((a, b) => {
      const startDiff = a.exploration.startedAt - b.exploration.startedAt;
      if (startDiff !== 0) return startDiff;
      const endA = a.exploration.endedAt ?? Number.MAX_SAFE_INTEGER;
      const endB = b.exploration.endedAt ?? Number.MAX_SAFE_INTEGER;
      const endDiff = endA - endB;
      if (endDiff !== 0) return endDiff;
      return a.originalIndex - b.originalIndex;
    });
}
