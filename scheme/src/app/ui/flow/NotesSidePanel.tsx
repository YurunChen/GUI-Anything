/**
 * NotesSidePanel — right column for recent notes + capture (CodeWhale-style split).
 */

import type { ReactNode } from 'react';
import { useTuiTheme } from '../theme';
import type { InspirationRecord } from '../../../data/protocol/observer-protocol';
import { InspirationPanel } from './InspirationPanel';
import { flowSpacing } from './flow-ui/flow-spacing';
import { getObserverMessages } from '../i18n/observer-messages';

export interface NotesSidePanelProps {
  width: number;
  inspirations: InspirationRecord[];
  inputFocused: boolean;
  onInputFocusChange: (focused: boolean) => void;
  onSaveInspiration: (text: string) => void;
}

export function NotesSidePanel({
  width,
  inspirations,
  inputFocused,
  onInputFocusChange,
  onSaveInspiration,
}: NotesSidePanelProps): ReactNode {
  const messages = getObserverMessages();
  const theme = useTuiTheme();

  return (
    <box
      style={{
        width,
        height: '100%',
        flexShrink: 0,
        flexDirection: 'column',
        backgroundColor: theme.semantic.fill.elevated,
        border: ['left'],
        borderColor: theme.semantic.separator,
        borderStyle: 'single',
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <text wrapMode="none" fg={theme.semantic.label.primary}>
        {`${messages.notesTitle} (${inspirations.length})`}
      </text>
      <box style={{ flexGrow: 1, flexDirection: 'column', minHeight: 8 }}>
        <InspirationPanel
          inspirations={inspirations}
          panelWidth={width}
          focused={inputFocused}
          onFocusChange={onInputFocusChange}
          onSave={onSaveInspiration}
        />
      </box>
    </box>
  );
}
