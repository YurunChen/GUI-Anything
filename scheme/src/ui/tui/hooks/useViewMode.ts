/**
 * ABOUTME: Shared hook for view mode toggle (flow/tree) across TUI views.
 */

import { useState, useCallback } from 'react';

export type ViewMode = 'flow' | 'tree';

export function useViewMode(initial: ViewMode = 'flow'): {
  viewMode: ViewMode;
  toggleViewMode: () => void;
} {
  const [viewMode, setViewMode] = useState<ViewMode>(initial);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'flow' ? 'tree' : 'flow'));
  }, []);

  return { viewMode, toggleViewMode };
}
