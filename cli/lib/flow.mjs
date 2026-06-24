import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
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
    skipDoctor: false,
    watch: true,
    open: true,
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
    if (arg === '--skip-doctor') {
      options.skipDoctor = true;
      continue;
    }
    if (arg === '--no-watch') {
      options.watch = false;
      continue;
    }
    if (arg === '--watch') {
      options.watch = true;
      continue;
    }
    if (arg === '--no-open') {
      options.open = false;
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

function evolutionOutputPath(rootDir) {
  return path.join(rootDir, 'wiki', 'knowledge', 'outputs', 'evolution.html');
}

/**
 * One-shot deterministic export. Guarantees a page exists on disk before we open
 * it — for a brand-new project this writes a self-refreshing placeholder instead
 * of failing, so there is always something to open.
 */
function exportEvolutionOnce({ rootDir, outputPath }) {
  if (!commandExists('bun')) return false;
  const result = spawnSync(
    'bun',
    ['run', 'src/main.ts', '--export-html', '--no-ai', '-o', outputPath],
    {
      cwd: path.join(rootDir, 'scheme'),
      stdio: 'ignore',
      env: { ...process.env, FLOW_ROOT_DIR: rootDir },
    },
  );
  return result.status === 0;
}

/** Open a file in the OS default browser (best-effort, non-blocking). */
function openInBrowser(target) {
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const child = spawn(opener, [target], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // best-effort
  }
}

/**
 * Background project-evolution HTML re-exporter, tied to a flow session's
 * lifetime. Runs deterministically (`--no-ai`) so the HTML refreshes instantly
 * as bundles land; the observer's `e` key (or `ga export`) produces the
 * AI-enriched version on demand.
 */
function startEvolutionWatcher({ rootDir, outputPath }) {
  if (!commandExists('bun')) return null;
  const child = spawn(
    'bun',
    ['run', 'src/main.ts', '--export-html', '--no-ai', '--watch', '-o', outputPath],
    {
      cwd: path.join(rootDir, 'scheme'),
      stdio: 'ignore',
      env: { ...process.env, FLOW_ROOT_DIR: rootDir },
    },
  );
  child.on('error', () => {});
  return { child, outputPath };
}

export function runFlowCommand({ rootDir, options }) {
  if (!commandExists('zellij')) {
    throw new Error('Zellij is required. Install with: brew install zellij');
  }

  if (!options.skipDoctor) {
    const doctor = runDoctor({ rootDir });
    if (!doctor.ok) {
      throw new Error('Doctor checks failed. Run `ga doctor` to see actionable fixes.');
    }
  }

  let watcher = null;
  const cleanupWatcher = () => {
    if (watcher && watcher.child && !watcher.child.killed) {
      try {
        watcher.child.kill('SIGTERM');
      } catch {
        // best-effort
      }
    }
  };

  if (options.watch !== false && commandExists('bun')) {
    const outputPath = evolutionOutputPath(rootDir);
    // First export is synchronous so the file is guaranteed to exist (real
    // timeline for an existing project, placeholder for a brand-new one) before
    // we open it in the browser.
    console.log('📊 Preparing evolution HTML…');
    exportEvolutionOnce({ rootDir, outputPath });
    if (options.open !== false) {
      openInBrowser(outputPath);
    }
    watcher = startEvolutionWatcher({ rootDir, outputPath });
    if (watcher) {
      console.log(`📊 Auto-refreshing evolution HTML → ${outputPath}`);
      console.log('   (disable with `ga flow --no-watch`)');
      process.on('exit', cleanupWatcher);
      process.on('SIGINT', () => {
        cleanupWatcher();
        process.exit(130);
      });
      process.on('SIGTERM', () => {
        cleanupWatcher();
        process.exit(143);
      });
    }
  }

  const scriptPath = path.join(rootDir, 'scripts', 'flow-run.sh');
  const scriptArgs = buildFlowScriptArgs(options);
  const result = spawnSync(scriptPath, scriptArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  cleanupWatcher();

  if (typeof result.status === 'number') {
    return result.status;
  }
  return 1;
}
