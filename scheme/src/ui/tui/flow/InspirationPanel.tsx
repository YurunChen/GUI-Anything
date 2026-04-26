/**
 * InspirationPanel - self-contained inspiration / notes panel.
 * Owns list + preview + capture flow; focus is driven by parent via props.
 */

import type { ReactNode } from 'react';
import { useState, useRef, useCallback } from 'react';
import type { TextareaRenderable } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/react';
import { colors } from '../theme';
import type { InspirationRecord } from '../../../runtime/wiki-auto-extractor';
import { getNotesSectionLayout } from './flow-constants';

export interface InspirationPanelProps {
  inspirations: InspirationRecord[];
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  onSave: (text: string) => void;
}

export function InspirationPanel({ inspirations, focused, onFocusChange, onSave }: InspirationPanelProps): ReactNode {
  const textareaRef = useRef<TextareaRenderable>(null);

  const handleSave = useCallback(() => {
    const text = textareaRef.current?.plainText ?? '';
    if (!text.trim()) return;

    onSave(text);
    textareaRef.current?.clear();
    textareaRef.current?.blur();
    onFocusChange(false);
  }, [onSave, onFocusChange]);

  const handleNotesAreaClick = () => {
    onFocusChange(false);
  };

  const handleInputAreaClick = (event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    onFocusChange(true);
  };

  return (
    <box style={{ flexDirection: 'column', height: '100%' }} onMouseDown={handleNotesAreaClick}>
      <scrollbox style={{ flexGrow: 1 }}>
        <box style={{ flexDirection: 'column', flexShrink: 0 }} onMouseDown={handleNotesAreaClick}>
          <NotesList inspirations={inspirations} />
        </box>

        <box
          style={{
            flexDirection: 'column',
            marginTop: 1,
            flexShrink: 0,
            paddingLeft: 1,
            paddingRight: 1,
          }}
          onMouseDown={handleInputAreaClick}
        >
          <text fg={colors.accent.secondary}>Write Notes</text>
          <box
            style={{
              flexDirection: 'column',
              marginTop: 1,
              border: true,
              borderColor: focused ? colors.border.active : colors.border.muted,
              backgroundColor: colors.bg.primary,
              paddingLeft: 1,
              paddingRight: 1,
            }}
          >
            <textarea
              ref={textareaRef}
              placeholder="One concise insight (plain text)..."
              focused={focused}
              keyBindings={[{ name: 'return', action: 'submit' }]}
              onSubmit={handleSave}
              style={{
                height: 3,
                wrapMode: 'char',
                backgroundColor: 'transparent',
                textColor: colors.fg.primary,
              }}
            />
          </box>
          {focused && (
            <text fg={colors.fg.muted} style={{ marginTop: 1, paddingLeft: 1 }}>
              [Enter] Save
            </text>
          )}
        </box>
      </scrollbox>
    </box>
  );
}

function formatNoteTimestamp(iso: string): string {
  const s = (iso || '').trim();
  if (!s) return '';
  // "2026-04-26T05:16:09.037Z" -> "2026-04-26 05:16"
  const date = s.slice(0, 10);
  const time = s.slice(11, 16);
  if (date.length < 10) return s.slice(0, 16);
  return `${date} ${time}`;
}

function truncateForListRow(title: string, maxChars: number): string {
  const t = title.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}...`;
}

function charDisplayWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  // Treat CJK / full-width glyphs as width 2 in terminal.
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

function lineDisplayWidth(line: string): number {
  let width = 0;
  for (const ch of line) {
    width += charDisplayWidth(ch);
  }
  return width;
}

function expandedTitleHeight(text: string, columnsPerLine: number): number {
  const safeCols = Math.max(10, columnsPerLine);
  const totalLines = text
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(lineDisplayWidth(line) / safeCols)), 0);
  return Math.max(2, totalLines);
}

function dedupeBodyAgainstTitle(title: string, body: string): string {
  const cleanTitle = title.trim();
  const lines = body.split('\n');
  const firstLine = (lines[0] || '').trim();
  if (cleanTitle && firstLine === cleanTitle) {
    return lines.slice(1).join('\n').trim();
  }
  return body.trim();
}

// Recent notes: click row to preview body below.
function NotesList({ inspirations }: { inspirations: InspirationRecord[] }): ReactNode {
  const { height: terminalHeight } = useTerminalDimensions();
  const { maxItems } = getNotesSectionLayout(terminalHeight);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleClick = (index: number) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
      return;
    }
    setExpandedIndex(index);
  };

  return (
    <box style={{ flexDirection: 'column', marginBottom: 1 }}>
      <text>
        <span fg={colors.accent.secondary}>Recent Notes</span>
        <span fg={colors.fg.dim}>{`  (${inspirations.length})`}</span>
      </text>

      {inspirations.length === 0 ? (
        <text fg={colors.fg.muted} style={{ marginTop: 1 }}>No notes yet</text>
      ) : (
        <box style={{ flexDirection: 'column', paddingLeft: 1 }}>
          {inspirations.slice(0, maxItems).map((item, index) => {
            const title = String(item?.title || '').trim() || `Note ${index + 1}`;
            const canExpand = title.length > 28;
            const isExpanded = expandedIndex === index;
            // Keep title start column aligned for rows with/without expand affordance.
            const prefix = canExpand ? (isExpanded ? '▾ ' : '▸ ') : '  ';
            const timeStr = formatNoteTimestamp(String(item?.created || ''));
            const titleShown = isExpanded ? title : truncateForListRow(title, 28);
            const expandedText = `${prefix}${title}`;
            const expandedHeight = expandedTitleHeight(expandedText, 28);
            return (
              <box
                key={item.path || index}
                style={{
                  flexDirection: 'column',
                  marginTop: 1,
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: isExpanded ? colors.bg.tertiary : 'transparent',
                }}
                onMouseDown={() => {
                  if (canExpand) handleClick(index);
                }}
              >
                {isExpanded && canExpand ? (
                  <textarea
                    initialValue={expandedText}
                    focused={false}
                    style={{
                      height: expandedHeight,
                      wrapMode: 'char',
                      backgroundColor: 'transparent',
                      textColor: colors.fg.primary,
                    }}
                  />
                ) : (
                  <text fg={colors.status.info}>
                    {prefix}
                    {titleShown}
                  </text>
                )}
                {timeStr ? <text fg={colors.fg.dim}>{timeStr}</text> : null}
              </box>
            );
          })}
        </box>
      )}
    </box>
  );
}

