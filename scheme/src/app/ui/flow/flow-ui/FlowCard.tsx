/**
 * FlowCard — grouped timeline unit with optional left tint (active) or elevation.
 */

import type { ReactNode } from 'react';
import { useTuiTheme } from '../../theme';

export type FlowCardVariant = 'flat' | 'elevated' | 'active';

interface FlowCardProps {
  variant?: FlowCardVariant;
  children: ReactNode;
}

export function FlowCard({ variant = 'flat', children }: FlowCardProps): ReactNode {
  const theme = useTuiTheme();
  const isActive = variant === 'active';
  const isElevated = variant === 'elevated';

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        marginBottom: 1,
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
        backgroundColor: isElevated ? theme.semantic.fill.elevated : theme.semantic.fill.base,
        border: isActive ? ['left'] : false,
        borderColor: isActive ? theme.semantic.tint : theme.semantic.separator,
      }}
    >
      {children}
    </box>
  );
}
