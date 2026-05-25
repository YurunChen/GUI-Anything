/**
 * CommandBar — bottom chrome: two-line hotkey hints (keys + action labels).
 * Single multiline <text> avoids OpenTUI sibling overlap in narrow panes (see HelpOverlay).
 */

import type { ReactNode } from 'react';
import { semantic } from '../theme';
import { COMPACT_LAYOUT_WIDTH } from '../../../constants/flow-constants';
import { flowSpacing } from './flow-ui/flow-spacing';
import {
  buildFooterHotkeyBody,
  buildObserverHotkeyHints,
  formatFooterHotkeyLines,
  type ObserverHotkeyContext,
} from './observer-hotkeys';

export type CommandBarContext = ObserverHotkeyContext;

export interface CommandBarProps {
  terminalWidth: number;
  context: CommandBarContext;
}

export function CommandBar({ terminalWidth, context }: CommandBarProps): ReactNode {
  const contentWidth = Math.max(24, terminalWidth - flowSpacing.chromePadX * 2);
  const isCompact = terminalWidth > 0 && terminalWidth < COMPACT_LAYOUT_WIDTH;
  const hints = buildObserverHotkeyHints(context);
  const lines = formatFooterHotkeyLines(hints, isCompact, contentWidth);
  const body = buildFooterHotkeyBody(lines);

  if (!body) return null;

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        flexShrink: 0,
        backgroundColor: semantic.fill.elevated,
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 0,
        paddingBottom: 0,
        border: ['top'],
        borderColor: semantic.separator,
        borderStyle: 'single',
      }}
    >
      <text wrapMode="none" fg={semantic.label.tertiary}>
        {body}
      </text>
    </box>
  );
}
