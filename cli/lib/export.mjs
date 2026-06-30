import path from 'node:path';
import { spawnSync } from 'node:child_process';

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], { stdio: 'pipe' });
  return result.status === 0;
}

function readOptionValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${optionName}`);
  }
  return value;
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
      options.output = readOptionValue(args, i, arg);
      i += 1;
      continue;
    }
    if (arg === '--theme') {
      options.theme = readOptionValue(args, i, arg);
      i += 1;
      continue;
    }
    if (arg === '--session-id') {
      options.sessionId = readOptionValue(args, i, arg);
      i += 1;
      continue;
    }
    if (arg === '--scope') {
      const scope = readOptionValue(args, i, arg);
      if (scope !== 'project' && scope !== 'session') {
        throw new Error(`Invalid value for --scope: ${scope}`);
      }
      options.scope = scope;
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

function exportRuntimeEnv(workspaceDir) {
  return {
    ...process.env,
    FLOW_PROJECT_DIR: workspaceDir,
    FLOW_ROOT_DIR: workspaceDir,
  };
}

export function buildExportScriptArgs(options, workspaceDir) {
  const output =
    options.output || path.join(workspaceDir, 'wiki', 'knowledge', 'outputs', 'evolution.html');
  const args = ['run', 'src/main.ts', '--export-html', '-o', output];
  if (options.noAi) args.push('--no-ai');
  if (options.theme) args.push('--theme', options.theme);
  if (options.sessionId) args.push('--session-id', options.sessionId);
  if (options.scope) args.push('--scope', options.scope);
  if (options.watch) args.push('--watch');
  return args;
}

export function runExportCommand({ rootDir, workspaceDir = rootDir, options }) {
  if (!commandExists('bun')) {
    throw new Error('bun is required. Install from https://bun.sh');
  }
  const schemeDir = path.join(rootDir, 'scheme');
  const args = buildExportScriptArgs(options, workspaceDir);
  const result = spawnSync('bun', args, {
    cwd: schemeDir,
    stdio: 'inherit',
    env: exportRuntimeEnv(workspaceDir),
  });
  if (typeof result.status === 'number') {
    return result.status;
  }
  return 1;
}
