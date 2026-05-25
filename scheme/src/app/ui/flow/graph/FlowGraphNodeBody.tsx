/**
 * Flow graph node — Apple-style two-line chrome: muted intent label, primary title.
 */

import type { ReactNode } from 'react';
import { FlowTextBlock } from '../FlowTextBlock';
import type { GraphNodeChromeParts } from './flow-graph-node-chrome';
import type { GraphTheme } from './graph-theme';

interface FlowGraphNodeBodyProps {
  parts: GraphNodeChromeParts;
  isFocus: boolean;
  theme: GraphTheme;
}

export function FlowGraphNodeBody({
  parts,
  isFocus,
  theme,
}: FlowGraphNodeBodyProps): ReactNode {
  const titleFg = isFocus ? theme.color.focusLabel : theme.color.label;

  return (
    <box style={{ flexDirection: 'column', minWidth: 0, width: '100%' }}>
      {parts.badge ? (
        <text wrapMode="none" fg={theme.color.muted}>
          {parts.badge}
        </text>
      ) : null}
      <FlowTextBlock fg={titleFg} wrapMode="word">
        {isFocus ? `▎ ${parts.title}` : parts.title}
      </FlowTextBlock>
    </box>
  );
}
