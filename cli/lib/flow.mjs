import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runDoctor } from './doctor.mjs';

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], { stdio: 'pipe' });
  return result.status === 0;
}

export function parseFlowArgs(args) {
  const options = {
    mode: 'new',
    resumeId: '',
    model: '',
    promptArgs: [],
    backend: 'auto',
    skipDoctor: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--continue' || arg === '-c') {
      options.mode = 'continue';
      continue;
    }
    if (arg === '--resume' || arg === '-r') {
      options.mode = 'resume';
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        options.resumeId = next;
        i += 1;
      }
      continue;
    }
    if (arg === '--model' || arg === '-m') {
      const model = args[i + 1];
      if (!model || model.startsWith('-')) {
        throw new Error('Missing value for --model');
      }
      options.model = model;
      i += 1;
      continue;
    }
    if (arg === '--backend') {
      const backend = args[i + 1];
      if (!backend || !['auto', 'zellij', 'tmux'].includes(backend)) {
        throw new Error('Invalid value for --backend, expected auto|zellij|tmux');
      }
      options.backend = backend;
      i += 1;
      continue;
    }
    if (arg === '--skip-doctor') {
      options.skipDoctor = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.mode = 'help';
      continue;
    }
    options.promptArgs.push(arg);
  }

  if (options.mode === 'continue' && options.resumeId) {
    throw new Error('Cannot combine --continue with --resume <id>');
  }

  return options;
}

export function resolveBackend(preferred = 'auto') {
  const hasZellij = commandExists('zellij');
  const hasTmux = commandExists('tmux');

  if (preferred === 'zellij') {
    if (!hasZellij) throw new Error('Requested backend `zellij` is not available.');
    return 'zellij';
  }

  if (preferred === 'tmux') {
    if (!hasTmux) throw new Error('Requested backend `tmux` is not available.');
    return 'tmux';
  }

  if (hasZellij) return 'zellij';
  if (hasTmux) return 'tmux';
  throw new Error('No terminal backend available. Install zellij (preferred) or tmux.');
}

function backendScriptPath(rootDir, backend) {
  return backend === 'zellij'
    ? path.join(rootDir, 'scripts', 'flow-run-zellij.sh')
    : path.join(rootDir, 'scripts', 'flow-run.sh');
}

export function buildFlowScriptArgs(options) {
  const args = [];
  if (options.mode === 'continue') {
    args.push('--continue');
  } else if (options.mode === 'resume') {
    args.push('--resume');
    if (options.resumeId) args.push(options.resumeId);
  }

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.promptArgs.length > 0) {
    args.push(...options.promptArgs);
  }

  return args;
}

export function runFlowCommand({ rootDir, options }) {
  if (!options.skipDoctor) {
    const doctor = runDoctor({ rootDir });
    if (!doctor.ok) {
      throw new Error('Doctor checks failed. Run `ga doctor` to see actionable fixes.');
    }
  }

  const backend = resolveBackend(options.backend);
  const scriptPath = backendScriptPath(rootDir, backend);
  const scriptArgs = buildFlowScriptArgs(options);
  const result = spawnSync(scriptPath, scriptArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (typeof result.status === 'number') {
    return result.status;
  }
  return 1;
}
