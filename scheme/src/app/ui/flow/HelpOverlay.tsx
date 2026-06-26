/**
 * HelpOverlay — keyboard shortcut reference (? / F1 / Ctrl+/ / / / Ctrl-K).
 * Single multiline <text> avoids OpenTUI row overlap in narrow panes.
 */

import type { ReactNode } from 'react';
import { useTuiTheme } from '../theme';
import { flowSpacing } from './flow-ui/flow-spacing';
import { getObserverMessages } from '../i18n/observer-messages';
import { buildHelpLinesFromHotkeys, type ObserverHotkeyContext } from './observer-hotkeys';

interface HelpOverlayProps {
  hotkeyContext: ObserverHotkeyContext;
}

export function buildHelpLines(ctx: ObserverHotkeyContext): string[] {
  return buildHelpLinesFromHotkeys(ctx);
}

export function buildHelpBody(ctx: ObserverHotkeyContext): string {
  const messages = getObserverMessages();
  return [messages.helpTitle, ...buildHelpLines(ctx)].join('\n');
}

export function HelpOverlay({ hotkeyContext }: HelpOverlayProps): ReactNode {
  const theme = useTuiTheme();
  const body = buildHelpBody(hotkeyContext);

  return (
    <box
      style={{
        width: '100%',
        flexShrink: 0,
        flexDirection: 'column',
        backgroundColor: theme.semantic.fill.elevated,
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 1,
        paddingBottom: 1,
        border: ['top'],
        borderColor: theme.semantic.separator,
        borderStyle: 'single',
      }}
    >
      <text wrapMode="none" fg={theme.semantic.label.secondary}>
        {body}
      </text>
    </box>
  );
}
