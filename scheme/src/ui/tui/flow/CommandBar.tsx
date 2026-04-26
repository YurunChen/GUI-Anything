/**
 * CommandBar - Bottom status bar with context-aware hotkeys
 * Design: minimal, context-aware hints.
 */

import type { ReactNode } from 'react';
import { colors } from '../theme';
import { COMPACT_LAYOUT_WIDTH } from './flow-constants';

export interface CommandBarProps {
  terminalWidth: number;
  inspirationInputFocused: boolean;
}

export function CommandBar({
  terminalWidth,
  inspirationInputFocused: _inspirationInputFocused,
}: CommandBarProps): ReactNode {
  const isCompact = terminalWidth > 0 ? terminalWidth < COMPACT_LAYOUT_WIDTH : false;

  const hotkeys: string[] = [];
  hotkeys.push(isCompact ? 't:view' : '[t] toggle view');
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
