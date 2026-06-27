import path from 'node:path';
import { spawnSync } from 'node:child_process';

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], { stdio: 'pipe' });
  return result.status === 0;
}

export function parseExportArgs(args) {
  const options = {
    mode: 'run',
    output: '',
    theme: '',
    sessionId: '',
    scope: '',
    noAi: false,
    watch: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-o' || arg === '--output') {
      options.output = args[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--theme') {
      options.theme = args[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--session-id') {
      options.sessionId = args[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--scope') {
      options.scope = args[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--no-ai') {
      options.noAi = true;
      continue;
    }
    if (arg === '--watch' || arg === '-w') {
      options.watch = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.mode = 'help';
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export function buildExportScriptArgs(options, rootDir) {
  const output =
    options.output || path.join(rootDir, 'wiki', 'knowledge', 'outputs', 'evolution.html');
  const args = ['run', 'src/main.ts', '--export-html', '-o', output];
  if (options.noAi) args.push('--no-ai');
  if (options.theme) args.push('--theme', options.theme);
  if (options.sessionId) args.push('--session-id', options.sessionId);
  if (options.scope) args.push('--scope', options.scope);
  if (options.watch) args.push('--watch');
  return args;
}

export function runExportCommand({ rootDir, options }) {
  if (!commandExists('bun')) {
    throw new Error('bun is required. Install from https://bun.sh');
  }
  const schemeDir = path.join(rootDir, 'scheme');
  const args = buildExportScriptArgs(options, rootDir);
  const result = spawnSync('bun', args, {
    cwd: schemeDir,
    stdio: 'inherit',
    env: { ...process.env, FLOW_ROOT_DIR: rootDir },
  });
  if (typeof result.status === 'number') {
    return result.status;
  }
  return 1;
}
