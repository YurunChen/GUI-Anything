import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';
import { buildTreeRows, type TreeDataNode, type TreeRow } from '../../../observer/view-model/tree-view-model';

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

export type { TreeDataNode, TreeRow };
export { buildTreeRows, buildTreeLevels } from '../../../observer/view-model/tree-view-model';
