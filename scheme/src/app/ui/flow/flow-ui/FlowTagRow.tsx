/**
 * Tag row — inline tags wrapped in corner brackets with spacing.
 */

import type { ReactNode } from 'react';
import { semantic } from '../../theme';

interface FlowTagRowProps {
  tags: string[];
  maxTags?: number;
  /** Wiki knowledge cards use theme wiki accent colors per tag. */
  variant?: 'default' | 'wiki';
}

function wikiTagColors(): string[] {
  return [
    semantic.wiki.tagColor,
    semantic.wiki.matchColor,
    semantic.wiki.labelColor,
    semantic.wiki.titleColor,
  ];
}

export function FlowTagRow({ tags, maxTags = 6, variant = 'default' }: FlowTagRowProps): ReactNode {
  const visible = tags.filter(Boolean).slice(0, maxTags);
  if (visible.length === 0) return null;

  const accentColors = variant === 'wiki' ? wikiTagColors() : null;
  const bracketColor = variant === 'wiki' ? semantic.wiki.labelColor : semantic.label.quaternary;

  return (
    <text>
      {visible.map((tag, idx) => {
        const tagColor = accentColors
          ? accentColors[idx % accentColors.length]
          : semantic.label.secondary;

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
