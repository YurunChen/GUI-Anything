export const WORKSPACE_TREE_SNAPSHOT_VERSION = 1 as const;

export interface WorkspaceTreeSnapshotNode {
  id: string;
  path: string;
  name: string;
  depth: number;
  isDir: boolean;
}

export interface WorkspaceTreeSnapshot {
  version: typeof WORKSPACE_TREE_SNAPSHOT_VERSION;
  rootPath: string;
  rootName: string;
  nodes: WorkspaceTreeSnapshotNode[];
  truncated: boolean;
  updatedAt: number;
}

