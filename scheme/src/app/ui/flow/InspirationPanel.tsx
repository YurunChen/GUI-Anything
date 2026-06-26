/**
 * InspirationPanel - self-contained inspiration / notes panel.
 * Owns list + preview + capture flow; focus is driven by parent via props.
 */

import type { ReactNode } from 'react';
import { useState, useRef, useCallback } from 'react';
import type { TextareaRenderable } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/react';
import { useTuiTheme } from '../theme';
import type { InspirationRecord } from '../../../data/protocol/observer-protocol';
import { getNotesSectionLayout } from '../../../constants/flow-constants';
import { lineDisplayWidth, truncateFlowText } from '../../../utils/flow-text';
import { FlowTextBlock } from './FlowTextBlock';
import { getObserverMessages } from '../i18n/observer-messages';

export interface InspirationPanelProps {
  inspirations: InspirationRecord[];
  /** Sidebar inner width (columns), for list truncation. */
  panelWidth?: number;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  onSave: (text: string) => void;
}

export function formatNoteListLine(prefix: string, title: string, timeStr: string, maxCols: number): string {
  const titleShown = truncateForListRow(title, Math.max(8, maxCols - lineDisplayWidth(prefix)));
  const line = `${prefix}${titleShown}`;
  if (!timeStr) return line;
  return `${line}\n  ${timeStr}`;
}

export function InspirationPanel({
  inspirations,
  panelWidth,
  focused,
  onFocusChange,
  onSave,
}: InspirationPanelProps): ReactNode {
  const m = getObserverMessages();
  const theme = useTuiTheme();
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
          <NotesList inspirations={inspirations} panelWidth={panelWidth ?? 28} messages={m} />
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
          <text fg={theme.semantic.label.secondary}>{m.notesWriteLabel}</text>
          <box
            style={{
              flexDirection: 'column',
              marginTop: 1,
              border: true,
              borderColor: focused ? theme.semantic.separatorActive : theme.semantic.separator,
              backgroundColor: theme.semantic.fill.base,
              paddingLeft: 1,
              paddingRight: 1,
            }}
          >
            <textarea
              ref={textareaRef}
              placeholder={m.notesPlaceholder}
              focused={focused}
              keyBindings={[{ name: 'return', action: 'submit' }]}
              onSubmit={handleSave}
              style={{
                height: 3,
                wrapMode: 'word',
                backgroundColor: theme.semantic.fill.base,
                textColor: theme.semantic.label.primary,
              }}
            />
          </box>
          {focused && (
            <text fg={theme.semantic.label.quaternary} style={{ marginTop: 1, paddingLeft: 1 }}>
              {m.notesEnterSave}
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

function truncateForListRow(title: string, maxCols: number): string {
  return truncateFlowText(title.trim(), maxCols, '...');
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

// Calculate actual usable columns considering padding/border
function calculateUsableColumns(containerWidth: number): number {
  // paddingLeft: 1 + paddingRight: 1 = 2
  const PADDING = 2;
  return Math.max(20, containerWidth - PADDING);
}

function NotesList({
  inspirations,
  panelWidth,
  messages,
}: {
  inspirations: InspirationRecord[];
  panelWidth: number;
  messages: ReturnType<typeof getObserverMessages>;
}): ReactNode {
  const { height: terminalHeight } = useTerminalDimensions();
  const theme = useTuiTheme();
  const { maxItems } = getNotesSectionLayout(terminalHeight);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const usableCols = calculateUsableColumns(Math.max(20, panelWidth - 2));

  const handleClick = (index: number) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
      return;
    }
    setExpandedIndex(index);
  };

  return (
    <box style={{ flexDirection: 'column', marginBottom: 1 }}>
      {inspirations.length === 0 ? (
        <text fg={theme.semantic.label.tertiary} style={{ marginTop: 1 }}>{messages.notesEmpty}</text>
      ) : (
        <box style={{ flexDirection: 'column', paddingLeft: 1 }}>
          {inspirations.slice(0, maxItems).map((item, index) => {
            const title = String(item?.title || '').trim() || `Note ${index + 1}`;
            const canExpand = lineDisplayWidth(title) > usableCols - 2; // -2 for prefix
            const isExpanded = expandedIndex === index;
            // Keep title start column aligned for rows with/without expand affordance.
            const prefix = canExpand ? (isExpanded ? '▾ ' : '▸ ') : '  ';
            const timeStr = formatNoteTimestamp(String(item?.created || ''));
            const collapsedLine = formatNoteListLine(prefix, title, timeStr, usableCols);
            const rawBody = String(item?.body || '').trim();
            const body = dedupeBodyAgainstTitle(title, rawBody);
            const expandedHead = `${prefix}${title}${timeStr ? `\n  ${timeStr}` : ''}`;
            return (
              <box
                key={item.path || index}
                style={{
                  flexDirection: 'column',
                  marginTop: 1,
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: isExpanded ? theme.semantic.fill.grouped : theme.semantic.fill.base,
                }}
                onMouseDown={() => {
                  if (canExpand) handleClick(index);
                }}
              >
                {isExpanded && canExpand ? (
                  <FlowTextBlock
                    text={body ? `${expandedHead}\n${body}` : expandedHead}
                    fg={theme.semantic.label.primary}
                  />
                ) : (
                  <text wrapMode="none" fg={theme.semantic.label.secondary}>
                    {collapsedLine}
                  </text>
                )}
              </box>
            );
          })}
        </box>
      )}
    </box>
  );
}
