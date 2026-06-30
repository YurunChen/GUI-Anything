import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { runDoctor } from './doctor.mjs';
import { readNotifyConfig } from './notify.mjs';

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
    watch: false,
    open: false,
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
      options.open = false;
      continue;
    }
    if (arg === '--watch') {
      options.watch = true;
      continue;
    }
    if (arg === '--open') {
      options.watch = true;
      options.open = true;
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

function flowRuntimeEnv(workspaceDir, baseEnv = process.env) {
  return {
    ...baseEnv,
    FLOW_PROJECT_DIR: workspaceDir,
    FLOW_ROOT_DIR: workspaceDir,
  };
}

function evolutionOutputPath(workspaceDir) {
  return path.join(workspaceDir, 'wiki', 'knowledge', 'outputs', 'evolution.html');
}

function resolveEvolutionServerPort(rootDir, workspaceDir) {
  const result = spawnSync(
    'bun',
    ['run', 'src/main.ts', '--evolution-port'],
    {
      cwd: path.join(rootDir, 'scheme'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: flowRuntimeEnv(workspaceDir),
    },
  );
  if (result.status !== 0) return null;
  const port = Number.parseInt(String(result.stdout).trim(), 10);
  return Number.isInteger(port) && port > 0 ? port : null;
}

/** Best-effort: is something already serving on this port? */
async function portIsLive(port) {
  try {
    const res = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(400),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * One-shot deterministic static export. Offline fallback so a page always exists
 * on disk even when the live server can't run (e.g. bun missing).
 */
function exportEvolutionOnce({ rootDir, workspaceDir, outputPath }) {
  if (!commandExists('bun')) return false;
  const result = spawnSync(
    'bun',
    ['run', 'src/main.ts', '--export-html', '--no-ai', '-o', outputPath],
    {
      cwd: path.join(rootDir, 'scheme'),
      stdio: 'ignore',
      env: flowRuntimeEnv(workspaceDir),
    },
  );
  return result.status === 0;
}

/**
 * Ensure the single per-project evolution server is running, then return its URL.
 * The server is a shared daemon (survives individual flow sessions) and enforces
 * single-writer via its port: a duplicate launch self-exits on EADDRINUSE. Returns
 * the http URL to open, or null if bun is unavailable.
 */
async function ensureEvolutionServer({ rootDir, workspaceDir }) {
  if (!commandExists('bun')) return null;
  const port = resolveEvolutionServerPort(rootDir, workspaceDir);
  if (!port) return null;
  if (!(await portIsLive(port))) {
    // Detached so it outlives this `ga flow` process; a duplicate exits immediately.
    const child = spawn(
      'bun',
      ['run', 'src/main.ts', '--evolution-server', '--port', String(port)],
      {
        cwd: path.join(rootDir, 'scheme'),
        stdio: 'ignore',
        detached: true,
        env: flowRuntimeEnv(workspaceDir),
      },
    );
    child.on('error', () => {});
    child.unref();
    // Wait briefly for readiness so the browser doesn't open to a dead port.
    for (let i = 0; i < 20; i += 1) {
      if (await portIsLive(port)) break;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return `http://localhost:${port}/`;
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

export function buildFlowEnv(rootDir, baseEnv = process.env, workspaceDir = rootDir) {
  const notifyConfig = readNotifyConfig(rootDir);
  return { ...notifyConfig, ...baseEnv, FLOW_PROJECT_DIR: workspaceDir, FLOW_ROOT_DIR: workspaceDir };
}

export async function runFlowCommand({ rootDir, workspaceDir = rootDir, options }) {
  if (!commandExists('zellij')) {
    throw new Error('Zellij is required. Install with: brew install zellij');
  }

  if (!options.skipDoctor) {
    const doctor = runDoctor({ rootDir: workspaceDir, notifyRootDir: rootDir });
    if (!doctor.ok) {
      throw new Error('Doctor checks failed. Run `ga doctor` to see actionable fixes.');
    }
  }

  // Do all async server setup + browser open BEFORE the blocking flow-run below
  // (spawnSync blocks the event loop, so awaited work must finish first).
  if (options.watch) {
    // Optional live view, served by a single per-project server that pushes updates
    // over WebSocket. Normal flow sessions keep the browser quiet; use `h` in the
    // observer for one-shot export/open, or `ga flow --watch --open` for this sidecar.
    console.log('📊 Starting optional evolution server…');
    const url = commandExists('bun') ? await ensureEvolutionServer({ rootDir, workspaceDir }) : null;
    if (url) {
      console.log(`📊 Live evolution: ${url}`);
      if (options.open) openInBrowser(url);
    } else if (options.open) {
      // bun/server unavailable — fall back to a one-shot static file so there's still something to open.
      const outputPath = evolutionOutputPath(workspaceDir);
      exportEvolutionOnce({ rootDir, workspaceDir, outputPath });
      openInBrowser(outputPath);
    }
  }

  const scriptPath = path.join(rootDir, 'scripts', 'flow-run.sh');
  const scriptArgs = buildFlowScriptArgs(options);
  const env = buildFlowEnv(rootDir, process.env, workspaceDir);
  if (!env.FLOW_NOTIFY_WECHAT_USER_ID && env.FLOW_NOTIFY_ENABLED !== 'false') {
    console.error('[ga flow] WeChat notifications are not configured. Run `ga notify setup` to enable them.');
    env.FLOW_NOTIFY_HINT_SHOWN = '1';
  }
  const result = spawnSync(scriptPath, scriptArgs, {
    cwd: workspaceDir,
    stdio: 'inherit',
    env,
  });

  if (typeof result.status === 'number') {
    return result.status;
  }
  return 1;
}
