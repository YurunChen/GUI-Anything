/**
 * FlowCard — grouped timeline unit with optional left tint (active) or elevation.
 */

import type { ReactNode } from 'react';
import { semantic } from '../../theme';

export type FlowCardVariant = 'flat' | 'elevated' | 'active';

interface FlowCardProps {
  variant?: FlowCardVariant;
  children: ReactNode;
}

export function FlowCard({ variant = 'flat', children }: FlowCardProps): ReactNode {
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
        backgroundColor: isElevated ? semantic.fill.elevated : semantic.fill.base,
        border: isActive ? ['left'] : false,
        borderColor: isActive ? semantic.tint : semantic.separator,
      }}
    >
      {children}
    </box>
  );
}
