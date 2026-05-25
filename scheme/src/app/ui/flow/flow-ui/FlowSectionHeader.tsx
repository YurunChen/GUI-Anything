/**
 * FlowSectionHeader — uppercase-style section caption above grouped inset.
 */

import type { ReactNode } from 'react';
import { semantic } from '../../theme';

interface FlowSectionHeaderProps {
  children: string;
}

export function FlowSectionHeader({ children }: FlowSectionHeaderProps): ReactNode {
  return (
    <text fg={semantic.label.quaternary} style={{ marginBottom: 0, paddingLeft: 1 }}>
      {children.toUpperCase()}
    </text>
  );
}
