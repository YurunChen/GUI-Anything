/**
 * CommandBar — bottom chrome: two-line hotkey hints (keys + action labels).
 * Single multiline <text> avoids OpenTUI sibling overlap in narrow panes (see HelpOverlay).
 */

import type { ReactNode } from 'react';
import { useTuiTheme } from '../theme';
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
  /** Temporary chrome activity, e.g. theme switch or exported HTML notice. */
  active?: boolean;
}

export function CommandBar({ terminalWidth, context, active = false }: CommandBarProps): ReactNode {
  const commandTheme = useTuiTheme().modes.commandBar;
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
        backgroundColor: commandTheme.backgroundColor,
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 0,
        paddingBottom: 0,
        border: ['top'],
        borderColor: active ? commandTheme.activeBorderColor : commandTheme.borderColor,
        borderStyle: 'single',
      }}
    >
      <text wrapMode="none" fg={commandTheme.textFg}>
        {body}
      </text>
    </box>
  );
}
