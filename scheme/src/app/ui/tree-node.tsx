/**
 * ABOUTME: Tree node renderer with depth indentation and connector lines.
 */

import type { ReactNode } from 'react';
import type { ActivityTree, ActivityNode } from '../../domain/types.js';
import { nodeLabel } from './node-label.js';
import { typeIcons, typeColors, colors } from './theme.js';

/**
 * Render each node with depth-aware indentation and tree connectors.
 * - Root: no indent, shows prompt text as section header
 * - Level 1 (tool_call/tool_result/thinking/response): "├─ " prefix
 * - Level 2+ (nested): deeper indent with "├─ " or "└─ " for last child
 */
export function TreeNode({
  node,
  depth,
  isLast,
  fileAccess,
}: {
  node: ActivityNode;
  depth: number;
  isLast: boolean;
  fileAccess: Map<string, number>;
}): ReactNode {
  const label = nodeLabel(node, fileAccess);
  if (!label) return null;

  const color = typeColors[node.type] ?? colors.fg.primary;
  const icon = typeIcons[node.type] ?? '·';

  // Build indent with vertical guides
  const indent = depth === 0
    ? ''
    : '  '.repeat(depth - 1) + (isLast ? '└─ ' : '├─ ');

  // Root node: bold header style
  if (depth === 0) {
    return (
      <text>
        <span fg={colors.status.info}>{label.length > 70 ? label.slice(0, 70) + '…' : label}</span>
      </text>
    );
  }

  // Tool call nodes that are parents: show a subtle separator line
  const hasChildren = node.childrenIds.length > 0;
  const separator = hasChildren && node.type === 'tool_call'
    ? <span fg={colors.fg.dim}> ─┬</span>
    : null;

  return (
    <text>
      <span fg={colors.fg.dim}>{indent}</span>
      <span fg={color}>{icon}</span>
      <span fg={colors.fg.primary}> {label}</span>
      {separator}
    </text>
  );
}

/**
 * Convert flat tree to ordered list with depth + isLast info for connectors.
 */
export function treeNodes(
  tree: ActivityTree,
): Array<{ node: ActivityNode; depth: number; isLast: boolean }> {
  const result: Array<{ node: ActivityNode; depth: number; isLast: boolean }> = [];

  const traverse = (nodeId: string, depth: number) => {
    const node = tree.nodes.get(nodeId);
    if (!node) return;

    const childCount = node.childrenIds.length;
    result.push({ node, depth, isLast: false }); // placeholder, fixed below

    for (let i = 0; i < childCount; i++) {
      traverse(node.childrenIds[i], depth + 1);
    }
  };

  traverse(tree.rootId, 0);

  // Fix isLast: mark last sibling at each depth level
  // Group by (parent, position) to determine last-of-parent
  const fixIsLast = () => {
    // For each node, find its parent's children, check if it's the last
    for (const entry of result) {
      if (entry.depth === 0) {
        entry.isLast = false; // root is never "last" in connector sense
        continue;
      }
      const parent = entry.node.parentId ? tree.nodes.get(entry.node.parentId) : null;
      if (!parent) continue;
      const lastChildId = parent.childrenIds[parent.childrenIds.length - 1];
      entry.isLast = entry.node.id === lastChildId;
    }
  };
  fixIsLast();

  return result;
}
