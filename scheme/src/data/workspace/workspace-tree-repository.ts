import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  WORKSPACE_TREE_SNAPSHOT_VERSION,
  type WorkspaceTreeSnapshot,
  type WorkspaceTreeSnapshotNode,
} from '../protocol/workspace-tree';

export interface WorkspaceTreeScanOptions {
  maxDepth?: number;
  maxNodes?: number;
  includeHidden?: boolean;
}

export interface WorkspaceTreeRepository {
  scan(rootPath: string, options?: WorkspaceTreeScanOptions): WorkspaceTreeSnapshot;
}

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_NODES = 240;
const DEFAULT_SKIPPED_NAMES = new Set([
  '.git',
  '.next',
  '.turbo',
  '.venv',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'wiki',
]);

interface IgnoreRules {
  names: Set<string>;
  prefixes: string[];
}

export class FileWorkspaceTreeRepository implements WorkspaceTreeRepository {
  scan(rootPath: string, options: WorkspaceTreeScanOptions = {}): WorkspaceTreeSnapshot {
    const resolvedRoot = resolveRoot(rootPath);
    const maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);
    const maxNodes = Math.max(1, options.maxNodes ?? DEFAULT_MAX_NODES);
    const includeHidden = options.includeHidden === true;
    const ignoreRules = readRootIgnoreRules(resolvedRoot);
    const nodes: WorkspaceTreeSnapshotNode[] = [];
    let truncated = false;

    const pushNode = (node: WorkspaceTreeSnapshotNode): boolean => {
      if (nodes.length >= maxNodes) {
        truncated = true;
        return false;
      }
      nodes.push(node);
      return true;
    };

    const rootName = path.basename(resolvedRoot) || resolvedRoot;
    pushNode({
      id: 'workspace-root',
      path: '',
      name: rootName,
      depth: 0,
      isDir: true,
    });

    const walk = (absDir: string, relDir: string, depth: number): void => {
      if (depth > maxDepth || truncated) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
      } catch {
        return;
      }

      const visible = entries
        .filter((entry) => shouldIncludeEntry(entry, relDir, includeHidden, ignoreRules))
        .sort(compareDirents);

      for (const entry of visible) {
        if (truncated) return;
        const relPath = normalizeRelativePath(path.join(relDir, entry.name));
        const isDir = entry.isDirectory();
        if (!pushNode({
          id: relPath,
          path: relPath,
          name: entry.name,
          depth,
          isDir,
        })) return;
        if (isDir) {
          walk(path.join(absDir, entry.name), relPath, depth + 1);
        }
      }
    };

    walk(resolvedRoot, '', 1);

    return {
      version: WORKSPACE_TREE_SNAPSHOT_VERSION,
      rootPath: resolvedRoot,
      rootName,
      nodes,
      truncated,
      updatedAt: Date.now(),
    };
  }
}

export const defaultWorkspaceTreeRepository = new FileWorkspaceTreeRepository();

function resolveRoot(rootPath: string): string {
  try {
    return fs.realpathSync(rootPath);
  } catch {
    return path.resolve(rootPath);
  }
}

function shouldIncludeEntry(
  entry: fs.Dirent,
  relDir: string,
  includeHidden: boolean,
  ignoreRules: IgnoreRules,
): boolean {
  if (!includeHidden && entry.name.startsWith('.')) return false;
  if (DEFAULT_SKIPPED_NAMES.has(entry.name)) return false;
  const relPath = normalizeRelativePath(path.join(relDir, entry.name));
  if (ignoreRules.names.has(entry.name) || ignoreRules.names.has(relPath)) return false;
  return !ignoreRules.prefixes.some((prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`));
}

function compareDirents(a: fs.Dirent, b: fs.Dirent): number {
  if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+/g, '/').replace(/\/$/, '');
}

function readRootIgnoreRules(rootPath: string): IgnoreRules {
  const names = new Set<string>();
  const prefixes: string[] = [];
  const ignorePath = path.join(rootPath, '.gitignore');
  let text = '';
  try {
    text = fs.readFileSync(ignorePath, 'utf-8');
  } catch {
    return { names, prefixes };
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const normalized = normalizeRelativePath(line.replace(/^\//, ''));
    if (!normalized || normalized.includes('*')) continue;
    if (line.endsWith('/') || normalized.includes('/')) {
      prefixes.push(normalized);
    } else {
      names.add(normalized);
    }
  }

  return { names, prefixes };
}

