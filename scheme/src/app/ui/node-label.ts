import type { ActivityNode } from '../../domain/types';

/**
 * Generate a one-line label for an activity tree node. Returns null for empty labels.
 */
export function nodeLabel(node: ActivityNode, fileAccess: Map<string, number>): string | null {
  let label = '';
  if (node.type === 'tool_call') {
    const content = node.content as { name?: string; input?: Record<string, unknown> };
    const name = content.name ?? 'unknown';
    const input = content.input ?? {};
    const inputPreview = Object.values(input).slice(0, 1).map(v => {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return s.length > 40 ? s.slice(0, 40) + '...' : s;
    }).join(' ');
    label = `${name} ${inputPreview}`;
    if (typeof input.path === 'string') {
      const count = fileAccess.get(input.path) || 0;
      if (count > 1) label += ` (×${count})`;
    }
  } else if (node.type === 'tool_result') {
    const content = node.content as { isError?: boolean; contentPreview?: string };
    if (content.isError) {
      label = 'ERROR';
    } else {
      label = content.contentPreview ? `ok (${content.contentPreview.slice(0, 40)})` : 'ok';
    }
  } else if (node.type === 'prompt') {
    const content = node.content as { text?: string };
    label = content.text ?? '';
  } else if (node.type === 'thinking') {
    const content = node.content as Record<string, unknown>;
    if (content.error) label = `error: ${content.error}`;
    else if (content.status) label = String(content.status);
    else label = 'thinking...';
  } else if (node.type === 'response') {
    const content = node.content as { text?: string };
    const text = content.text ?? '';
    label = text.length > 80 ? text.slice(0, 80) + '...' : text;
  }
  return label || null;
}
