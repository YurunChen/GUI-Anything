/**
 * ContextPanel - side panel shell (width, border, visibility).
 * Delegates note UI to InspirationPanel.
 */

import type { ReactNode } from 'react';
import { colors } from '../theme';
import type { InspirationRecord } from '../../../runtime/wiki-auto-extractor';
import type { ContextTab } from './flow-observer-state';
import { InspirationPanel } from './InspirationPanel';
import { getContextPanelLayout } from './flow-constants';

export interface ContextPanelProps {
  activeTab: ContextTab;
  terminalWidth: number;
  inputFocused: boolean;
  onInputFocusChange: (focused: boolean) => void;
  inspirations: InspirationRecord[];
  onSaveInspiration: (text: string) => void;
}

export function ContextPanel({
  activeTab,
  terminalWidth,
  inputFocused,
  onInputFocusChange,
  inspirations,
  onSaveInspiration,
}: ContextPanelProps): ReactNode {
  if (activeTab !== 'inspiration') return null;

  const layout = getContextPanelLayout(terminalWidth);

  return (
    <box
      style={{
        width: layout.width,
        flexBasis: layout.flexBasis,
        flexShrink: 0,
        minWidth: layout.minWidth,
        maxWidth: layout.maxWidth,
        height: '100%',
        flexDirection: 'column',
        border: true,
        borderColor: colors.border.muted,
        backgroundColor: colors.bg.secondary,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <InspirationPanel
        inspirations={inspirations}
        focused={inputFocused}
        onFocusChange={onInputFocusChange}
        onSave={onSaveInspiration}
      />
    </box>
  );
}
