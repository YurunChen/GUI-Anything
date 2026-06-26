/**
 * FlowSectionHeader — uppercase-style section caption above grouped inset.
 */

import type { ReactNode } from 'react';
import { useTuiTheme } from '../../theme';

interface FlowSectionHeaderProps {
  children: string;
}

export function FlowSectionHeader({ children }: FlowSectionHeaderProps): ReactNode {
  const theme = useTuiTheme();
  return (
    <text fg={theme.modes.timeline.summary.labelFallbackFg} style={{ marginBottom: 0, paddingLeft: 1 }}>
      {children.toUpperCase()}
    </text>
  );
}
