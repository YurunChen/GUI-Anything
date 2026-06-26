import type {
  Exploration,
  FileActivity,
  FileActivityAction,
} from '../../../data/protocol/observer-protocol';
import type { WorkspaceTreeSnapshot } from '../../../data/protocol/workspace-tree';

export interface WorkspaceTraceRow {
  id: string;
  action: FileActivityAction;
  status: FileActivity['status'];
  summary: string;
  path?: string;
  timestamp: number;
}

export interface WorkspaceTreeNode {
  id: string;
  path: string;
  name: string;
  depth: number;
  isDir: boolean;
  isLast: boolean;
  connector: boolean[];
  activity?: FileActivity;
  isActive: boolean;
  isRecent: boolean;
}

export interface WorkspaceActivityView {
  tree: WorkspaceTreeNode[];
  trace: WorkspaceTraceRow[];
  hasRunning: boolean;
}

interface MutableTreeNode {
  path: string;
  name: string;
  isDir: boolean;
  children: Map<string, MutableTreeNode>;
  activity?: FileActivity;
  latestTimestamp: number;
}

export function buildWorkspaceActivityView(
  explorations: Exploration[],
  traceLimit: number = 14,
  workspaceTree?: WorkspaceTreeSnapshot | null,
): WorkspaceActivityView {
  const rows = collectTraceRows(explorations, workspaceTree?.rootPath);
  const active = [...rows].reverse().find((row) => row.status === 'running')
    ?? rows[rows.length - 1];
  const recentPaths = new Set(rows.slice(-4).map((row) => row.path).filter(Boolean) as string[]);
  const tree = buildWorkspaceTree(rows, active?.path, recentPaths, workspaceTree);

  return {
    tree,
    trace: rows.slice(-traceLimit),
    hasRunning: rows.some((row) => row.status === 'running'),
  };
}

function collectTraceRows(
  explorations: Exploration[],
  workspaceRoot: string | undefined,
): WorkspaceTraceRow[] {
  const rows: WorkspaceTraceRow[] = [];
  for (const exploration of explorations) {
    for (const node of exploration.nodes) {
      if (!node.fileActivity) continue;
      rows.push({
        id: `${exploration.id}:${node.id}`,
        action: node.fileActivity.action,
        status: node.fileActivity.status,
        summary: node.fileActivity.summary,
        path: normalizeActivityPath(node.fileActivity.path, workspaceRoot),
        timestamp: node.timestamp,
      });
    }
  }
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

function buildWorkspaceTree(
  rows: WorkspaceTraceRow[],
  activePath: string | undefined,
  recentPaths: Set<string>,
  workspaceTree: WorkspaceTreeSnapshot | null | undefined,
): WorkspaceTreeNode[] {
  const root: MutableTreeNode = {
    path: '',
    name: workspaceTree?.rootName || 'workspace',
    isDir: true,
    children: new Map(),
    latestTimestamp: 0,
  };

  if (workspaceTree) {
    for (const node of workspaceTree.nodes) {
      if (!node.path) continue;
      insertSnapshotPath(root, node.path, node.isDir);
    }
  }

  for (const row of rows) {
    if (!row.path) continue;
    insertPath(root, row.path, {
      action: row.action,
      status: row.status,
      path: row.path,
      summary: row.summary,
    }, row.timestamp);
  }

  return flattenTree(root, 0, [], activePath, recentPaths, true);
}

function insertSnapshotPath(root: MutableTreeNode, rawPath: string, isDir: boolean): void {
  const segments = displayPathSegments(rawPath);
  let current = root;

  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;
    const childPath = current.path ? `${current.path}/${segment}` : segment;
    let child = current.children.get(segment);
    if (!child) {
      child = {
        path: childPath,
        name: segment,
        isDir: !isLeaf || isDir,
        children: new Map(),
        latestTimestamp: 0,
      };
      current.children.set(segment, child);
    }
    child.isDir = child.isDir || !isLeaf || isDir;
    current = child;
  });
}

function insertPath(root: MutableTreeNode, rawPath: string, activity: FileActivity, timestamp: number): void {
  const segments = displayPathSegments(rawPath);
  let current = root;
  current.latestTimestamp = Math.max(current.latestTimestamp, timestamp);

  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;
    const childPath = current.path ? `${current.path}/${segment}` : segment;
    let child = current.children.get(segment);
    if (!child) {
      child = {
        path: childPath,
        name: segment,
        isDir: !isLeaf || activityTargetLooksDirectory(activity),
        children: new Map(),
        latestTimestamp: 0,
      };
      current.children.set(segment, child);
    }
    child.isDir = child.isDir || !isLeaf || activityTargetLooksDirectory(activity);
    child.latestTimestamp = Math.max(child.latestTimestamp, timestamp);
    if (isLeaf) {
      child.activity = activity;
    }
    current = child;
  });
}

function activityTargetLooksDirectory(activity: FileActivity): boolean {
  if (!activity.path || (activity.action !== 'search' && activity.action !== 'run')) return false;
  const clean = activity.path.replace(/\\/g, '/').replace(/\/$/, '');
  const leaf = clean.split('/').filter(Boolean).pop() ?? '';
  return leaf !== '' && !leaf.includes('.');
}

function normalizeActivityPath(rawPath: string | undefined, workspaceRoot: string | undefined): string | undefined {
  if (!rawPath) return undefined;
  const clean = rawPath.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (!workspaceRoot || !clean.startsWith('/')) return clean;
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (clean === root) return '';
  if (!clean.startsWith(`${root}/`)) return clean;
  return clean.slice(root.length + 1);
}

function displayPathSegments(rawPath: string): string[] {
  const clean = rawPath.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.?\//, '').replace(/\/$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return [rawPath || 'unknown'];
  if (clean.startsWith('/') && parts.length > 4) {
    return ['...', ...parts.slice(-4)];
  }
  if (!clean.startsWith('/') && parts.length > 6) {
    return ['...', ...parts.slice(-6)];
  }
  return parts;
}

function flattenTree(
  node: MutableTreeNode,
  depth: number,
  connector: boolean[],
  activePath: string | undefined,
  recentPaths: Set<string>,
  isLast: boolean,
): WorkspaceTreeNode[] {
  const out: WorkspaceTreeNode[] = [{
    id: node.path || 'workspace',
    path: node.activity?.path ?? node.path,
    name: node.name,
    depth,
    isDir: node.isDir,
    isLast,
    connector,
    activity: node.activity,
    isActive: !!activePath && node.activity?.path === activePath,
    isRecent: !!node.activity?.path && recentPaths.has(node.activity.path),
  }];

  const children = [...node.children.values()].sort(compareTreeNodes);
  children.forEach((child, index) => {
    const childIsLast = index === children.length - 1;
    out.push(...flattenTree(
      child,
      depth + 1,
      depth === 0 ? [] : [...connector, isLast],
      activePath,
      recentPaths,
      childIsLast,
    ));
  });

  return out;
}

function compareTreeNodes(a: MutableTreeNode, b: MutableTreeNode): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
  return a.name.localeCompare(b.name);
}
