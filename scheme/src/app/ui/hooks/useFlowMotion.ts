/**
 * Shared low-frequency motion tick for subtle TUI feedback.
 */

import { useEffect, useState } from 'react';

export function isFlowMotionEnabled(): boolean {
  const raw = (process.env.FLOW_NO_ANIMATIONS || '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return false;
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  return true;
}

export function useFlowMotionFrame(active: boolean = true, intervalMs: number = 720): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active || !isFlowMotionEnabled()) return;
    const timer = setInterval(() => {
      setFrame((prev) => prev + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return frame;
}
