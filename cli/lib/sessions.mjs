import path from 'node:path';
import { spawnSync } from 'node:child_process';

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], { stdio: 'pipe' });
  return result.status === 0;
}

export function runSessionsCommand({ rootDir, workspaceDir = rootDir }) {
  if (!commandExists('bun')) {
    throw new Error('bun is required. Install from https://bun.sh');
  }
  const schemeDir = path.join(rootDir, 'scheme');
  const result = spawnSync('bun', ['run', 'src/main.ts', '--list-sessions'], {
    cwd: schemeDir,
    stdio: 'inherit',
    env: { ...process.env, FLOW_PROJECT_DIR: workspaceDir, FLOW_ROOT_DIR: workspaceDir },
  });
  if (typeof result.status === 'number') {
    return result.status;
  }
  return 1;
}
