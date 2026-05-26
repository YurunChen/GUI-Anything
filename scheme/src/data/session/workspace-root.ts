import * as fs from 'node:fs';
import { resolveGitRoot } from './claude-project';

/** Canonical git workspace root for cache stamping / validation. */
export function resolveWorkspaceRootForCache(cwd?: string): string {
  const base = process.env.FLOW_PROJECT_DIR || process.env.FLOW_ROOT_DIR || cwd || process.cwd();
  try {
    return resolveGitRoot(fs.realpathSync(base));
  } catch {
    return resolveGitRoot(base);
  }
}

export function workspaceRootsMatch(saved: string, current: string): boolean {
  const normalize = (p: string) => {
    try {
      return resolveGitRoot(fs.realpathSync(p));
    } catch {
      return resolveGitRoot(p);
    }
  };
  return normalize(saved) === normalize(current);
}
