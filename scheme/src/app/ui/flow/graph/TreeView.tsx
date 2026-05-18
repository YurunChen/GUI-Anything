import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

export interface TreeDataNode<TMeta = unknown> {
  id: string;
  text: string;
  children: TreeDataNode<TMeta>[];
  meta?: TMeta;
}

export interface TreeRow<TMeta = unknown> {
  node: TreeDataNode<TMeta>;
  depth: number;
  isLast: boolean;
  connectorPrefix: string;
  continuationPrefix: string;
}

export interface TreeViewProps<TMeta = unknown> {
  data: TreeDataNode<TMeta>[];
  renderNode?: (row: TreeRow<TMeta>) => ReactNode;
}

export const TreeView = memo(function TreeView<TMeta = unknown>(props: TreeViewProps<TMeta>): ReactNode {
  const { data, renderNode } = props;
  const rows = useMemo(() => buildTreeRows(data), [data]);

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {rows.map((row) => (
        <box key={row.node.id} style={{ width: '100%', flexDirection: 'column' }}>
          {renderNode ? (
            renderNode(row)
          ) : (
            <text>
              <span>{row.connectorPrefix}</span>
              <span>{row.node.text}</span>
            </text>
          )}
        </box>
      ))}
    </box>
  );
});

export function buildTreeRows<TMeta = unknown>(data: TreeDataNode<TMeta>[]): TreeRow<TMeta>[] {
  const rows: TreeRow<TMeta>[] = [];

  const walk = (
    node: TreeDataNode<TMeta>,
    prefix: string,
    isLast: boolean,
    depth: number,
  ) => {
    const connectorPrefix = depth === 0 ? '' : `${prefix}${isLast ? '└─' : '├─'}`;
    const continuationPrefix = depth === 0 ? '' : `${prefix}${isLast ? '  ' : '│ '}`;
    rows.push({ node, depth, isLast, connectorPrefix, continuationPrefix });
    for (let i = 0; i < node.children.length; i++) {
      walk(node.children[i], continuationPrefix, i === node.children.length - 1, depth + 1);
    }
  };

  for (let i = 0; i < data.length; i++) {
    walk(data[i], '', i === data.length - 1, 0);
  }

  return rows;
}

export function buildTreeLevels<TMeta = unknown>(data: TreeDataNode<TMeta>[]): TreeDataNode<TMeta>[][] {
  const levels: TreeDataNode<TMeta>[][] = [];
  if (data.length === 0) return levels;
  let queue: TreeDataNode<TMeta>[] = [...data];
  while (queue.length > 0) {
    levels.push(queue);
    const next: TreeDataNode<TMeta>[] = [];
    for (const node of queue) {
      next.push(...node.children);
    }
    queue = next;
  }
  return levels;
}
