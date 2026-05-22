import { describe, expect, it } from 'bun:test';
import type { FlowGraphSnapshot } from '../../../../data/protocol/observer-protocol';
import { buildFlowTreeData } from './FlowGraphView';
import { buildTreeRows } from './TreeView';

describe('buildFlowTreeRows', () => {
  it('renders a parent-child tree order with connector prefixes', () => {
    const treeData = buildFlowTreeData(makeSnapshot());
    const rows = buildTreeRows(treeData);
    expect(rows.map((row) => row.node.id)).toEqual(['s:root', 's:left', 's:right', 's:leaf']);
    expect(rows[0].connectorPrefix).toBe('');
    expect(rows[1].connectorPrefix).toBe('├─');
    expect(rows[2].connectorPrefix).toBe('└─');
    expect(rows[3].connectorPrefix).toBe('  └─');
  });

  it('keeps incoming edge semantics for rendering glyphs', () => {
    const treeData = buildFlowTreeData(makeSnapshot());
    const rows = buildTreeRows(treeData);
    expect(rows[1].node.meta?.incomingKind).toBe('fork_repair');
    expect(rows[2].node.meta?.incomingKind).toBe('fork_alternative');
    expect(rows[3].node.meta?.incomingKind).toBe('merge');
  });
});

function makeSnapshot(): FlowGraphSnapshot {
  return {
    nodes: [
      {
        id: 's:root',
        explorationId: 'root',
        label: 'root',
        status: 'complete',
        startedAt: 100,
        summaryPreview: 'root',
        metaBadges: { tools: 1, errors: 0, wiki: 'none' },
      },
      {
        id: 's:left',
        explorationId: 'left',
        label: 'left',
        status: 'error',
        startedAt: 200,
        summaryPreview: 'left',
        metaBadges: { tools: 2, errors: 1, wiki: 'none' },
      },
      {
        id: 's:right',
        explorationId: 'right',
        label: 'right',
        status: 'complete',
        startedAt: 300,
        summaryPreview: 'right',
        metaBadges: { tools: 1, errors: 0, wiki: 'saved' },
      },
      {
        id: 's:leaf',
        explorationId: 'leaf',
        label: 'leaf',
        status: 'complete',
        startedAt: 400,
        summaryPreview: 'leaf',
        metaBadges: { tools: 1, errors: 0, wiki: 'saved' },
      },
    ],
    edges: [
      { from: 's:root', to: 's:left', kind: 'fork_repair' },
      { from: 's:root', to: 's:right', kind: 'fork_alternative' },
      { from: 's:right', to: 's:leaf', kind: 'merge' },
    ],
    focusNodeId: 's:leaf',
    updatedAt: 1,
  };
}
