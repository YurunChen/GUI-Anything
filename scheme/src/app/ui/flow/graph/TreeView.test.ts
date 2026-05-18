import { describe, expect, it } from 'bun:test';
import { buildTreeRows, type TreeDataNode } from './TreeView';

describe('buildTreeRows', () => {
  it('supports generic treeData structure with text and children', () => {
    const treeData: TreeDataNode[] = [
      {
        id: 'root',
        text: '组织架构树',
        children: [
          { id: 'left', text: '多级数据展示', children: [] },
          { id: 'right', text: '自定义样式', children: [] },
        ],
      },
    ];

    const rows = buildTreeRows(treeData);
    expect(rows.map((row) => row.node.text)).toEqual([
      '组织架构树',
      '多级数据展示',
      '自定义样式',
    ]);
    expect(rows.map((row) => row.connectorPrefix)).toEqual(['', '├─', '└─']);
    expect(rows[1].continuationPrefix).toBe('│ ');
    expect(rows[2].continuationPrefix).toBe('  ');
  });
});
