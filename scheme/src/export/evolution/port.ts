import * as fs from 'node:fs';

import { resolveGitRoot } from '../../data/session/claude-project';

export function resolveEvolutionServerRoot(rootDir?: string): string {
  const base = rootDir || process.env.FLOW_ROOT_DIR || process.env.FLOW_PROJECT_DIR || process.cwd();
  try {
    return resolveGitRoot(fs.realpathSync(base));
  } catch {
    try {
      return resolveGitRoot(base);
    } catch {
      return base;
    }
  }
}

/** Deterministic per-project port for the live evolution server. */
export function evolutionServerPort(root: string): number {
  let h = 5381;
  for (let i = 0; i < root.length; i += 1) h = ((h << 5) + h + root.charCodeAt(i)) >>> 0;
  return 40000 + (h % 10000);
}
