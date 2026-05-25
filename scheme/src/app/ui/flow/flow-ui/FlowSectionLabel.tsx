/**
 * Muted section label — must render as <text> (OpenTUI: span only valid inside text).
 */

import type { ReactNode } from 'react';
import { semantic } from '../../theme';

interface FlowSectionLabelProps {
  children: string;
}

export function FlowSectionLabel({ children }: FlowSectionLabelProps): ReactNode {
  return <text fg={semantic.label.tertiary}>{children}</text>;
}

/** Inline label span for use inside an existing <text> or FlowTextBlock. */
export function FlowSectionLabelSpan({ children }: FlowSectionLabelProps): ReactNode {
  return <span fg={semantic.label.tertiary}>{children}</span>;
}
