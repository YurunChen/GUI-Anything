/**
 * WikiMatchCard - 显示匹配的 Wiki 知识卡片
 */

import type { ReactNode } from 'react';
import type { WikiMatch } from '../../../data/protocol/observer-protocol';
import { colors } from '../theme';

interface WikiMatchCardProps {
  match: WikiMatch;
  availableWidth: number;
}

export function WikiMatchCard({ match, availableWidth }: WikiMatchCardProps): ReactNode {
  const scorePercent = Math.round(match.score * 100);
  const maxContentWidth = Math.max(40, availableWidth - 8);

  // Wrap content text
  const contentLines = wrapText(match.entry.content, maxContentWidth);

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
        backgroundColor: colors.wiki.background,
      }}
    >
      {/* Header: 💡 知识匹配 */}
      <box style={{ flexDirection: 'row', marginBottom: 1 }}>
        <text>
          <span fg={colors.wiki.titleColor}>{'💡 '}</span>
          <span fg={colors.wiki.labelColor}>{'相关知识'}</span>
          <span fg={colors.fg.dim}>{'  │  '}</span>
          <span fg={colors.wiki.matchColor}>{`匹配度 ${scorePercent}%`}</span>
        </text>
      </box>

      {/* Title */}
      <text fg={colors.wiki.titleColor}>
        {match.entry.request}
      </text>

      {/* Content */}
      <box style={{ flexDirection: 'column', marginTop: 1 }}>
        {contentLines.map((line, idx) => (
          <text key={idx} fg={colors.wiki.contentColor}>
            {line}
          </text>
        ))}
      </box>

      {/* Tags */}
      {match.entry.tags && match.entry.tags.length > 0 && (
        <box style={{ flexDirection: 'row', marginTop: 1 }}>
          <text fg={colors.fg.muted}>
            {'🏷️  '}
            {match.entry.tags.map((tag, idx) => (
              <span key={idx} fg={colors.wiki.tagColor}>
                {idx > 0 ? ' · ' : ''}
                {tag}
              </span>
            ))}
          </text>
        </box>
      )}
    </box>
  );
}

// Helper function
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (getDisplayWidth(testLine) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function getDisplayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    // CJK characters are typically double-width
    const code = char.charCodeAt(0);
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
      (code >= 0xac00 && code <= 0xd7af)    // Hangul
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}
