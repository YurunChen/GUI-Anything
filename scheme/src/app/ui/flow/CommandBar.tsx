/**
 * CommandBar - Bottom status bar with context-aware hotkeys
 * Design: minimal, context-aware hints.
 */

import type { ReactNode } from 'react';
import { colors } from '../theme';
import { COMPACT_LAYOUT_WIDTH } from '../../../constants/flow-constants';

export interface CommandBarProps {
  terminalWidth: number;
  inspirationInputFocused: boolean;
  observerMode: 'exploration' | 'flowchart';
}

export function CommandBar({
  terminalWidth,
  inspirationInputFocused: _inspirationInputFocused,
  observerMode,
}: CommandBarProps): ReactNode {
  const isCompact = terminalWidth > 0 ? terminalWidth < COMPACT_LAYOUT_WIDTH : false;
  const nextMode = observerMode === 'exploration' ? 'flowchart' : 'exploration';

  const hotkeys: string[] = [];
  hotkeys.push(isCompact ? `g:${nextMode}` : `[g] switch to ${nextMode}`);
  hotkeys.push(isCompact ? 'i:notes' : '[i] open/close notes');
  hotkeys.push(isCompact ? 'q:quit' : '[q] quit');
  const hotkeyText = hotkeys.join(isCompact ? ' | ' : '  ');

  return (
    <box
      style={{
        width: '100%',
        backgroundColor: colors.bg.tertiary,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={colors.fg.dim}>
        {hotkeyText}
      </text>
    </box>
  );
}
