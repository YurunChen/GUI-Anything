import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import type { WorkspaceTreeSnapshot } from '../../../data/protocol/workspace-tree';
import { buildWorkspaceActivityView } from './workspace-activity';

describe('buildWorkspaceActivityView', () => {
  it('builds a cltree-style virtual tree from touched files', () => {
    const view = buildWorkspaceActivityView([
      exploration([
        {
          id: 'n1',
          timestamp: 1,
          type: 'tool',
          status: 'ok',
          label: 'Read',
          fileActivity: {
            action: 'read',
            status: 'ok',
            path: 'docs/development.md',
            summary: 'docs/development.md',
          },
        },
        {
          id: 'n2',
          timestamp: 2,
          type: 'tool',
          status: 'running',
          label: 'Edit',
          fileActivity: {
            action: 'edit',
            status: 'running',
            path: 'scheme/src/data/session/jsonl-session.ts',
            summary: 'data/session/jsonl-session.ts - 2 -> 3 lines',
          },
        },
      ]),
    ]);

    expect(view.hasRunning).toBe(true);
    expect(view.trace.map((row) => row.action)).toEqual(['read', 'edit']);
    expect(view.tree.map((node) => node.name)).toEqual([
      'workspace',
      'docs',
      'development.md',
      'scheme',
      'src',
      'data',
      'session',
      'jsonl-session.ts',
    ]);
    expect(view.tree.find((node) => node.name === 'jsonl-session.ts')?.isActive).toBe(true);
    expect(view.tree.find((node) => node.name === 'development.md')?.activity?.status).toBe('ok');
  });

  it('treats bash-style search targets without extensions as directories', () => {
    const view = buildWorkspaceActivityView([
      exploration([
        {
          id: 'n1',
          timestamp: 1,
          type: 'tool',
          status: 'ok',
          label: 'Bash',
          fileActivity: {
            action: 'search',
            status: 'ok',
            path: 'scheme/src/app',
            summary: 'List app directory',
          },
        },
      ]),
    ]);

    const appNode = view.tree.find((node) => node.path === 'scheme/src/app');

    expect(appNode?.name).toBe('app');
    expect(appNode?.isDir).toBe(true);
  });

  it('uses a full workspace tree snapshot as background structure', () => {
    const snapshot = workspaceSnapshot([
      ['docs', 1, true],
      ['docs/development.md', 2, false],
      ['scheme', 1, true],
      ['scheme/src', 2, true],
      ['scheme/src/main.ts', 3, false],
    ]);
    const view = buildWorkspaceActivityView([
      exploration([
        {
          id: 'n1',
          timestamp: 1,
          type: 'tool',
          status: 'ok',
          label: 'Read',
          fileActivity: {
            action: 'read',
            status: 'ok',
            path: '/repo/scheme/src/main.ts',
            summary: 'scheme/src/main.ts',
          },
        },
      ]),
    ], 14, snapshot);

    expect(view.tree.map((node) => node.name)).toEqual([
      'repo',
      'docs',
      'development.md',
      'scheme',
      'src',
      'main.ts',
    ]);
    expect(view.tree.find((node) => node.path === 'scheme/src/main.ts')?.activity?.action).toBe('read');
  });
});

function exploration(nodes: Exploration['nodes']): Exploration {
  return {
    id: 'exp_1',
    question: 'q',
    startedAt: 0,
    status: 'running',
    currentPhase: 'execute',
    phaseSeen: { explore: true, execute: true, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes,
  };
}

function workspaceSnapshot(nodes: Array<[path: string, depth: number, isDir: boolean]>): WorkspaceTreeSnapshot {
  return {
    version: 1,
    rootPath: '/repo',
    rootName: 'repo',
    nodes: [
      {
        id: 'workspace-root',
        path: '',
        name: 'repo',
        depth: 0,
        isDir: true,
      },
      ...nodes.map(([nodePath, depth, isDir]) => ({
        id: nodePath,
        path: nodePath,
        name: nodePath.split('/').pop() ?? nodePath,
        depth,
        isDir,
      })),
    ],
    truncated: false,
    updatedAt: 1,
  };
}
