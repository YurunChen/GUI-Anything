/**
 * Muted section label — must render as <text> (OpenTUI: span only valid inside text).
 */

import type { ReactNode } from 'react';
import { useTuiTheme } from '../../theme';

interface FlowSectionLabelProps {
  children: string;
}

export function FlowSectionLabel({ children }: FlowSectionLabelProps): ReactNode {
  const theme = useTuiTheme();
  return <text fg={theme.semantic.label.tertiary}>{children}</text>;
}

/** Inline label span for use inside an existing <text> or FlowTextBlock. */
export function FlowSectionLabelSpan({ children }: FlowSectionLabelProps): ReactNode {
  const theme = useTuiTheme();
  return <span fg={theme.semantic.label.tertiary}>{children}</span>;
}
