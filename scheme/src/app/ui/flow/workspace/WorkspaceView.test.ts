import { describe, expect, test } from 'bun:test';
import type { WorkspaceTreeNode } from '../../../observer/view-model/workspace-activity';
import {
  formatWorkspaceTreeLine,
  resolveActiveCursor,
  resolveWorkspaceTreeRowLimit,
  resolveWorkspaceViewLayout,
  selectWorkspaceTreeNodes,
} from './WorkspaceView';

describe('resolveWorkspaceViewLayout', () => {
  test('stacks tree and trace when the pane is narrow', () => {
    const layout = resolveWorkspaceViewLayout(52);
    expect(layout.stacked).toBe(true);
    expect(layout.treeWidth).toBe(layout.traceWidth);
  });

  test('keeps a useful tree window even in stacked layout', () => {
    const layout = resolveWorkspaceViewLayout(52);

    expect(resolveWorkspaceTreeRowLimit(layout)).toBe(19);
  });

  test('uses available height for the tree viewport', () => {
    const layout = resolveWorkspaceViewLayout(96, 40);

    expect(resolveWorkspaceTreeRowLimit(layout)).toBe(35);
  });

  test('uses side-by-side columns when the pane is wide enough', () => {
    const layout = resolveWorkspaceViewLayout(96);
    expect(layout.stacked).toBe(false);
    expect(layout.treeWidth).toBeGreaterThanOrEqual(28);
    expect(layout.traceWidth).toBeGreaterThanOrEqual(28);
  });

  test('uses a cltree-style contiguous viewport ending at the recent file path', () => {
    const tree = makeTree([
      ['workspace', 0, false],
      ['scheme', 1, false],
      ['src', 2, false],
      ['app', 3, false],
      ['ui', 4, false],
      ['flow', 5, false],
      ['workspace', 6, false],
      ['WorkspaceView.tsx', 7, true],
      ['docs', 1, false],
      ['THEMES.md', 2, false],
    ]);

    const selected = selectWorkspaceTreeNodes(tree, 7);

    expect(selected.map((node) => node.name)).toEqual([
      'scheme',
      'src',
      'app',
      'ui',
      'flow',
      'workspace',
      'WorkspaceView.tsx',
    ]);
  });

  test('scrolls the viewport to keep the active target visible', () => {
    const tree = makeTree([
      ['workspace', 0, false],
      ['scheme', 1, false],
      ['src', 2, false],
      ['app', 3, false],
      ['ui', 4, false],
      ['flow', 5, false],
      ['WorkspaceView.tsx', 6, true],
    ]);

    const selected = selectWorkspaceTreeNodes(tree, 4);

    expect(selected.map((node) => node.name)).toEqual([
      'app',
      'ui',
      'flow',
      'WorkspaceView.tsx',
    ]);
  });

  test('marks the active node once without replacing the file tree icon', () => {
    const [root, dir, file] = makeTree([
      ['workspace', 0, false],
      ['cli', 1, false],
      ['ga.mjs', 2, false],
    ]);
    dir.isActive = true;
    file.isActive = true;

    expect(formatWorkspaceTreeLine({
      node: dir,
      marker: '▾ ',
      prefix: '├── ',
      width: 80,
    })).toBe('├── ▾ ● cli');
    expect(formatWorkspaceTreeLine({
      node: file,
      marker: '· ',
      prefix: '│   └── ',
      width: 80,
    })).toBe('│   └── · ● ga.mjs');
    expect(root.name).toBe('workspace');
  });

  test('animates the active cursor without changing tree structure', () => {
    expect(resolveActiveCursor(0)).toBe('● ');
    expect(resolveActiveCursor(1)).toBe('◉ ');
    expect(resolveActiveCursor(2)).toBe('● ');
  });
});

function makeTree(input: Array<[name: string, depth: number, recent: boolean]>): WorkspaceTreeNode[] {
  return input.map(([name, depth, recent], index) => ({
    id: `${index}:${name}`,
    path: input.slice(0, index + 1).map(([part]) => part).join('/'),
    name,
    depth,
    isDir: index < input.length - 1,
    isLast: index === input.length - 1,
    connector: [],
    isActive: false,
    isRecent: recent,
  }));
}
