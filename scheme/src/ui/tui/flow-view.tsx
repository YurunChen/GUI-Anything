/**
 * ABOUTME: Flow TUI panel — compact single-line timeline rows.
 * Always rendered inside a parent container's scrollbox (no nested scrollboxes).
 */

import { useKeyboard } from '@opentui/react';
import type { ReactNode } from 'react';
import { useState, useCallback } from 'react';
import type { ActivityTree } from '../../core/types';
import { colors, typeIcons, typeColors } from './theme';
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
        color: typeColors[node.type] ?? colors.fg.primary,
        sideColor: colors.status.warning,
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
          color: content.isError ? colors.status.error : colors.status.success,
          sideColor: content.isError ? colors.status.error : colors.status.success,
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
          color: content.isError ? colors.status.error : colors.status.success,
          sideColor: content.isError ? colors.status.error : colors.status.success,
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
        color: typeColors[node.type] ?? colors.fg.primary,
        sideColor: colors.accent.secondary,
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
          color: colors.status.error,
          sideColor: colors.status.error,
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
      <text fg={colors.fg.dim}>● ● ● Collecting activity…</text>
    );
  }

  const rows = timelineRows(tree);
  const baseTs = tree.nodes.get(tree.rootId)?.timestamp ?? Date.now();

  // Build stats parts into ONE text element
  const buildStats = () => {
    const parts: Array<{ text: string; fg?: string }> = [];
    parts.push({ text: `[${tree.nodes.size}n `, fg: colors.accent.primary });
    parts.push({ text: `${tree.stats.toolCallCount}t`, fg: colors.fg.secondary });
    parts.push({ text: ` │ ${tree.stats.responseCount}r]` });
    if (tree.alerts.length > 0) {
      parts.push({ text: ` ${tree.alerts.length}w`, fg: colors.status.warning });
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
    parts.push({ text: timeStr, fg: colors.fg.dim });
    parts.push({ text: ' ┃ ' });
    parts.push({ text: row.icon, fg: row.color });
    parts.push({ text: row.label, fg: sel ? colors.fg.primary : colors.fg.secondary });
    if (row.resultStatus === 'pending' && !sel) {
      parts.push({ text: ' …', fg: colors.fg.dim });
    }

    return parts;
  };

  return (
    <>
      {/* Stats bar — one text element, no spacers */}
      <text fg={colors.fg.dim}>
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
        <text fg={colors.border.muted}>─ end ─</text>
      )}
    </>
  );
}
