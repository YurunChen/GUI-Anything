/**
 * FlowInsetGroup — flat timeline card: left accent + padded content (no inner boxes).
 */

import type { ReactNode } from 'react';
import { semantic } from '../../theme';
import { flowSpacing } from './flow-spacing';

interface FlowInsetGroupProps {
  children: ReactNode;
  /** Brighter accent bar for focused / running exploration */
  accent?: boolean;
}

export function FlowInsetGroup({ children, accent = false }: FlowInsetGroupProps): ReactNode {
  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        marginBottom: flowSpacing.cardGap,
        paddingLeft: flowSpacing.cardPadX,
        paddingRight: flowSpacing.cardPadX,
        paddingTop: flowSpacing.cardPadY,
        paddingBottom: flowSpacing.cardPadY,
        backgroundColor: semantic.fill.grouped,
        border: ['left'],
        borderColor: accent ? semantic.tint : semantic.tintMuted,
      }}
    >
      {children}
    </box>
  );
}

interface FlowSectionProps {
  label: string;
  children: ReactNode;
  /** Insert blank line before section label */
  gap?: boolean;
}

/** Uppercase section label + body — typography only, no extra frame. */
export function FlowSection({ label, children, gap = true }: FlowSectionProps): ReactNode {
  return (
    <>
      {gap && <FlowLineGap />}
      <text fg={semantic.label.quaternary}>{label.toUpperCase()}</text>
      {children}
    </>
  );
}

interface FlowFramedSectionProps {
  label: string;
  children: ReactNode;
  /** Insert blank line before section label */
  gap?: boolean;
  /** Visual tone for the inner frame */
  variant?: 'knowledge' | 'neutral';
}

/** Section label + bordered inset box (e.g. Knowledge vs flat Summary). */
export function FlowFramedSection({
  label,
  children,
  gap = true,
  variant = 'neutral',
}: FlowFramedSectionProps): ReactNode {
  const isKnowledge = variant === 'knowledge';

  return (
    <>
      {gap && <FlowLineGap />}
      <text fg={isKnowledge ? semantic.wiki.labelColor : semantic.label.quaternary}>
        {label.toUpperCase()}
      </text>
      <box
        style={{
          width: '100%',
          flexDirection: 'column',
          paddingLeft: flowSpacing.cardPadX,
          paddingRight: flowSpacing.cardPadX,
          paddingTop: flowSpacing.cardPadY,
          paddingBottom: flowSpacing.cardPadY,
          backgroundColor: isKnowledge ? semantic.wiki.background : semantic.fill.elevated,
          border: true,
          borderColor: isKnowledge ? semantic.wiki.matchColor : semantic.separator,
          borderStyle: 'single',
        }}
      >
        {children}
      </box>
    </>
  );
}

/** Single blank terminal row for breathing room between blocks. */
export function FlowLineGap(): ReactNode {
  return <text>{' '}</text>;
}
