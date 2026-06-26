/**
 * Animated banner while cycling themes with `[` `]`.
 */

import { useEffect, useRef, useState } from 'react';
import type { ThemeName } from './index';
import { resolveThemeStyleMeta } from './theme-style-registry';
import { isFlowMotionEnabled } from '../hooks/useFlowMotion';

export interface ThemeSwitchBanner {
  frame: string;
  familyLabel: string;
  themeLabel: string;
}

export function useThemeSwitchBanner(): {
  banner: ThemeSwitchBanner | undefined;
  trigger: (name: ThemeName, themeLabel: string) => void;
} {
  const [banner, setBanner] = useState<ThemeSwitchBanner | undefined>();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  };

  useEffect(() => () => clearTimers(), []);

  const trigger = (name: ThemeName, themeLabel: string) => {
    clearTimers();
    const meta = resolveThemeStyleMeta(name);
    const frames = meta.switchFrames.length > 0 ? meta.switchFrames : ['◆'];
    let index = 0;

    const paint = () => {
      setBanner({
        frame: frames[index % frames.length] ?? '◆',
        familyLabel: meta.familyLabel,
        themeLabel,
      });
      index += 1;
    };

    if (!isFlowMotionEnabled()) {
      paint();
      hideRef.current = setTimeout(() => setBanner(undefined), 1400);
      return;
    }

    paint();
    timerRef.current = setInterval(paint, meta.switchIntervalMs);
    hideRef.current = setTimeout(() => {
      clearTimers();
      setBanner(undefined);
    }, 1400);
  };

  return { banner, trigger };
}
