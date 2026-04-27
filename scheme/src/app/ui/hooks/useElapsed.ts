/**
 * ABOUTME: Shared hook for elapsed timer across TUI views.
 */

import { useState, useEffect } from 'react';

export function useElapsed(): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((prev) => prev + 1000), 1000);
    return () => clearInterval(interval);
  }, []);

  return elapsed;
}
