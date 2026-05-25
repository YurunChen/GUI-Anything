/**
 * SummaryBlock — summary row inside grouped inset (no nested box).
 */

import type { ReactNode } from 'react';
import { semantic } from '../../theme';
import { FlowTextBlock } from '../FlowTextBlock';
import { FlowSectionLabelSpan } from './FlowSectionLabel';

interface SummaryBlockProps {
  label?: string;
  body: string;
  bodyFg?: string;
}

export function SummaryBlock({
  label = 'Summary',
  body,
  bodyFg = semantic.label.secondary,
}: SummaryBlockProps): ReactNode {
  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      <text>
        <FlowSectionLabelSpan>{`${label}  `}</FlowSectionLabelSpan>
      </text>
      <FlowTextBlock text={body} fg={bodyFg} />
    </box>
  );
}
