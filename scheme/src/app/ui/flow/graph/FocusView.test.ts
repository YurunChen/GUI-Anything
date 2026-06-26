import { describe, expect, it } from 'bun:test';
import type { FlowGraphSnapshot } from '../../../../data/protocol/observer-protocol';
import { buildFocusDisplay, buildFlowTreeData } from '../../../observer/view-model/focus-guide-view';
import { buildTreeRows } from '../../../observer/view-model/tree-view-model';
import { formatFocusRowTitle } from './FocusView';

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

  it('keeps incoming edge relationships for rendering glyphs', () => {
    const treeData = buildFlowTreeData(makeSnapshot());
    const rows = buildTreeRows(treeData);
    expect(rows[1].node.meta?.incomingRelationship).toBe('repair');
    expect(rows[2].node.meta?.incomingRelationship).toBe('side');
    expect(rows[3].node.meta?.incomingRelationship).toBe('merge');
  });

  it('builds the compact Focus main path and branches', () => {
    const snapshot = makeSnapshot();
    snapshot.nodes[0].label = 'Auth Middleware Map';
    snapshot.nodes[1].label = 'Replay Banner Copy';
    snapshot.nodes[1].intentKey = 'implement';
    snapshot.nodes[2].label = 'Wiki Curator Triggers';
    snapshot.nodes[2].intentKey = 'explore';
    snapshot.nodes[3].label = 'Persist Policy Tests';
    snapshot.nodes[3].intentKey = 'test_verify';
    snapshot.nodes[3].status = 'running';

    const display = buildFocusDisplay(snapshot, 'en');

    expect(display.mainRows.map((row) => ({
      badge: row.badge,
      title: row.title,
      relationship: row.relationship,
      isFocus: row.isFocus,
      isActive: row.isActive,
      depth: row.depth,
    }))).toEqual([
      { badge: 'Explore', title: 'Auth Middleware Map', relationship: 'root', isFocus: false, isActive: false, depth: 0 },
      { badge: 'Explore', title: 'Wiki Curator Triggers', relationship: 'side', isFocus: false, isActive: false, depth: 1 },
      { badge: 'Verify', title: 'Persist Policy Tests', relationship: 'merge', isFocus: true, isActive: true, depth: 2 },
    ]);
    expect(display.branchRows.map((row) => ({
      badge: row.badge,
      title: row.title,
      relationship: row.relationship,
      isFocus: row.isFocus,
      isActive: row.isActive,
      depth: row.depth,
    }))).toEqual([
      { badge: 'Implement', title: 'Replay Banner Copy', relationship: 'repair', isFocus: false, isActive: false, depth: 1 },
    ]);
  });

  it('truncates focus row titles by terminal width for Chinese text', () => {
    const title = formatFocusRowTitle({
      title: '实现 workspace 文件树动画，并检查主题系统在 TUI 中是否稳定',
      suffix: '',
      budget: 24,
    });

    expect(title).toBe(' 实现 workspace 文件树…');
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
        intentKey: 'explore',
      },
      {
        id: 's:left',
        explorationId: 'left',
        label: 'left',
        status: 'error',
        startedAt: 200,
        summaryPreview: 'left',
        metaBadges: { tools: 2, errors: 1, wiki: 'none' },
        intentKey: 'debug',
      },
      {
        id: 's:right',
        explorationId: 'right',
        label: 'right',
        status: 'complete',
        startedAt: 300,
        summaryPreview: 'right',
        metaBadges: { tools: 1, errors: 0, wiki: 'saved' },
        intentKey: 'implement',
      },
      {
        id: 's:leaf',
        explorationId: 'leaf',
        label: 'leaf',
        status: 'complete',
        startedAt: 400,
        summaryPreview: 'leaf',
        metaBadges: { tools: 1, errors: 0, wiki: 'saved' },
        intentKey: 'implement',
      },
    ],
    edges: [
      { from: 's:root', to: 's:left', relationship: 'repair' },
      { from: 's:root', to: 's:right', relationship: 'side' },
      { from: 's:right', to: 's:leaf', relationship: 'merge' },
    ],
    focusNodeId: 's:leaf',
    updatedAt: 1,
  };
}
