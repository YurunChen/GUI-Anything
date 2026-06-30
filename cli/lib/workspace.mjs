import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function realpathOrSelf(dir) {
  try {
    return fs.realpathSync(dir);
  } catch {
    return dir;
  }
}

function gitRootOrSelf(dir) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return dir;
  const root = result.stdout.trim();
  return root || dir;
}

export function resolveWorkspaceDir({ cwd = process.cwd(), env = process.env } = {}) {
  const base = path.resolve(env.FLOW_PROJECT_DIR || cwd);
  return gitRootOrSelf(realpathOrSelf(base));
}
