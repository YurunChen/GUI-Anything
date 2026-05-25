/**
 * FlowTextBlock — read-only prose using OpenTUI native wrap (CJK-aware).
 * Applies `formatFlowText` for plain `text` prop; use `children` for styled spans.
 */

import type { ReactNode } from 'react';
import { formatFlowText } from '../../../utils/flow-text';

type FlowWrapMode = 'word' | 'char' | 'none';

interface FlowTextBlockProps {
  /** Plain text — normalized via formatFlowText before render. */
  text?: string;
  children?: ReactNode;
  fg?: string;
  wrapMode?: FlowWrapMode;
}

export function FlowTextBlock({
  text,
  children,
  fg,
  wrapMode = 'char',
}: FlowTextBlockProps): ReactNode {
  const content = text !== undefined ? formatFlowText(text) : children;

  return (
    <box style={{ flexDirection: 'column', minWidth: 0 }}>
      <text wrapMode={wrapMode} fg={fg} style={{ width: '100%' }}>
        {content}
      </text>
    </box>
  );
}
