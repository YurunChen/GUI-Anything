/**
 * Tag row — inline tags wrapped in corner brackets with spacing.
 */

import type { ReactNode } from 'react';
import { useTuiTheme } from '../../theme';

interface FlowTagRowProps {
  tags: string[];
  maxTags?: number;
  /** Wiki knowledge cards use theme wiki accent colors per tag. */
  variant?: 'default' | 'wiki';
}

export function FlowTagRow({ tags, maxTags = 6, variant = 'default' }: FlowTagRowProps): ReactNode {
  const tuiTheme = useTuiTheme();
  const visible = tags.filter(Boolean).slice(0, maxTags);
  if (visible.length === 0) return null;

  const accentColors = variant === 'wiki' ? tuiTheme.modes.wiki.tagColors : null;
  const bracketColor = variant === 'wiki'
    ? tuiTheme.modes.wiki.tagBracketFg
    : tuiTheme.semantic.label.quaternary;

  return (
    <text>
      {visible.map((tag, idx) => {
        const tagColor = accentColors
          ? accentColors[idx % accentColors.length]
          : tuiTheme.semantic.label.secondary;

        return (
          <span key={`${tag}_${idx}`}>
            {idx > 0 ? '  ' : ''}
            <span fg={bracketColor}>{'「'}</span>
            <span fg={tagColor}>{tag}</span>
            <span fg={bracketColor}>{'」'}</span>
          </span>
        );
      })}
    </text>
  );
}
