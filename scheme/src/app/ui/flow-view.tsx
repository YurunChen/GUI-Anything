/**
 * ABOUTME: Flow TUI panel — compact single-line timeline rows.
 * Always rendered inside a parent container's scrollbox (no nested scrollboxes).
 */

import { useKeyboard } from '@opentui/react';
import type { ReactNode } from 'react';
import { useState, useCallback } from 'react';
import type { ActivityTree } from '../../domain/types';
import { tuiTheme, typeIcons } from './theme';
import { truncate, toPreview } from '../../utils/string';

interface FlowViewProps {
  tree: ActivityTree | null;
  running: boolean;
  elapsed: number;
}

interface FlowRow {
  key: string;
  timestamp: number;
  icon: string;
  label: string;
  color: string;
  sideColor: string;
  resultStatus?: 'success' | 'error' | 'pending';
}

function timelineRows(tree: ActivityTree): FlowRow[] {
  const theme = tuiTheme;
  const nodes = [...tree.nodes.values()].sort((a, b) => a.timestamp - b.timestamp);
  const rows: FlowRow[] = [];
  const pending = new Map<string, number>();

  for (const node of nodes) {
    if (node.type === 'prompt') continue;

    if (node.type === 'tool_call') {
      const content = node.content as { toolCallId?: string; name?: string; input?: Record<string, unknown> };
      const name = content.name ?? 'unknown';
      const preview = content.input ? toPreview(Object.values(content.input)[0] ?? '', 48) : '';
      const label = preview ? `${name} ${preview}` : name;
      rows.push({
        key: node.id,
        timestamp: node.timestamp,
        icon: typeIcons[node.type] ?? '⚡',
        label: truncate(label, 96),
        color: activityTypeColor(node.type),
        sideColor: theme.semantic.warning,
        resultStatus: 'pending',
      });
      if (content.toolCallId) {
        pending.set(content.toolCallId, rows.length - 1);
      }
      continue;
    }

    if (node.type === 'tool_result') {
      const content = node.content as { toolCallId?: string; isError?: boolean; contentPreview?: string };
      const suffix = content.contentPreview ? ` ${truncate(content.contentPreview, 36)}` : '';
      const idx = content.toolCallId ? pending.get(content.toolCallId) : undefined;
      if (idx !== undefined) {
        const prev = rows[idx];
        rows[idx] = {
          ...prev,
          icon: content.isError ? '✗' : '✓',
          color: content.isError ? theme.semantic.destructive : theme.semantic.success,
          sideColor: content.isError ? theme.semantic.destructive : theme.semantic.success,
          label: `${prev.label}${suffix}`,
          resultStatus: content.isError ? 'error' : 'success',
        };
        pending.delete(content.toolCallId!);
      } else {
        rows.push({
          key: node.id,
          timestamp: node.timestamp,
          icon: content.isError ? '✗' : '✓',
          label: content.contentPreview ?? '',
          color: content.isError ? theme.semantic.destructive : theme.semantic.success,
          sideColor: content.isError ? theme.semantic.destructive : theme.semantic.success,
          resultStatus: content.isError ? 'error' : 'success',
        });
      }
      continue;
    }

    if (node.type === 'response') {
      const content = node.content as { text?: string };
      const text = (content.text ?? '').trim();
      if (!text) continue;
      rows.push({
        key: node.id,
        timestamp: node.timestamp,
        icon: typeIcons[node.type] ?? '💬',
        label: truncate(text.replace(/\s+/g, ' '), 96),
        color: activityTypeColor(node.type),
        sideColor: theme.semantic.tintMuted,
      });
      continue;
    }

    if (node.type === 'thinking') {
      const content = node.content as { error?: string };
      if (content?.error) {
        rows.push({
          key: node.id,
          timestamp: node.timestamp,
          icon: '!',
          label: truncate(`error: ${content.error}`, 96),
          color: theme.semantic.destructive,
          sideColor: theme.semantic.destructive,
        });
      }
    }
  }

  return rows;
}

function formatTimeOffset(offsetMs: number): string {
  const totalSecs = Math.floor(offsetMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function FlowView({ tree, running, elapsed }: FlowViewProps): ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const theme = tuiTheme;

  useKeyboard(useCallback((key: { name: string }) => {
    if (!tree) return;
    const rows = timelineRows(tree);
    if (key.name === 'j' || key.name === 'down') {
      setSelectedIndex(prev => Math.min(prev + 1, rows.length - 1));
    } else if (key.name === 'k' || key.name === 'up') {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    }
  }, [tree]));

  if (!tree) {
    return (
      <text fg={theme.semantic.label.quaternary}>● ● ● Collecting activity…</text>
    );
  }

  const rows = timelineRows(tree);
  const baseTs = tree.nodes.get(tree.rootId)?.timestamp ?? Date.now();

  // Build stats parts into ONE text element
  const buildStats = () => {
    const parts: Array<{ text: string; fg?: string }> = [];
    parts.push({ text: `[${tree.nodes.size}n `, fg: theme.semantic.tint });
    parts.push({ text: `${tree.stats.toolCallCount}t`, fg: theme.semantic.label.secondary });
    parts.push({ text: ` │ ${tree.stats.responseCount}r]` });
    if (tree.alerts.length > 0) {
      parts.push({ text: ` ${tree.alerts.length}w`, fg: theme.semantic.warning });
    }
    return parts;
  };

  // Build row parts into ONE text element
  const buildRowLine = (row: FlowRow, sel: boolean) => {
    const offset = row.timestamp - baseTs;
    const timeStr = formatTimeOffset(offset);
    const parts: Array<{ text: string; fg?: string }> = [];

    if (sel) {
      parts.push({ text: `│`, fg: row.sideColor });
    } else {
      parts.push({ text: row.resultStatus === 'pending' ? '│' : '└', fg: row.sideColor });
    }
    parts.push({ text: ' ', fg: row.sideColor });
    parts.push({ text: timeStr, fg: theme.semantic.label.quaternary });
    parts.push({ text: ' ┃ ' });
    parts.push({ text: row.icon, fg: row.color });
    parts.push({ text: row.label, fg: sel ? theme.semantic.label.primary : theme.semantic.label.secondary });
    if (row.resultStatus === 'pending' && !sel) {
      parts.push({ text: ' …', fg: theme.semantic.label.quaternary });
    }

    return parts;
  };

  return (
    <>
      {/* Stats bar — one text element, no spacers */}
      <text fg={theme.semantic.label.quaternary}>
        {buildStats().map((p, i) => (
          <span key={i} fg={p.fg}>{p.text}</span>
        ))}
      </text>

      {/* Timeline rows — each is ONE text element for proper single-line rendering */}
      {rows.map((row, i) => {
        const sel = i === selectedIndex;
        const parts = buildRowLine(row, sel);

        return (
          <text key={row.key}>
            {parts.map((p, pi) => (
              <span key={pi} fg={p.fg}>{p.text}</span>
            ))}
          </text>
        );
      })}

      {/* End marker */}
      {!running && rows.length > 0 && (
        <text fg={theme.semantic.separator}>─ end ─</text>
      )}
    </>
  );
}

function activityTypeColor(type: string): string {
  const theme = tuiTheme;
  switch (type) {
    case 'prompt':
      return theme.semantic.info;
    case 'thinking':
      return theme.semantic.label.tertiary;
    case 'tool_call':
      return theme.semantic.warning;
    case 'tool_result':
      return theme.semantic.success;
    case 'response':
      return theme.semantic.label.primary;
    case 'group':
      return theme.semantic.tintMuted;
    default:
      return theme.semantic.label.primary;
  }
}
