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

/** Deterministic per-project port — must match evolutionServerPort() in
 *  scheme/src/export/evolution/server.ts (djb2 → 40000–49999). */
function evolutionServerPort(root) {
  let h = 5381;
  for (let i = 0; i < root.length; i += 1) h = ((h << 5) + h + root.charCodeAt(i)) >>> 0;
  return 40000 + (h % 10000);
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

/**
 * Ensure the single per-project evolution server is running, then return its URL.
 * The server is a shared daemon (survives individual flow sessions) and enforces
 * single-writer via its port: a duplicate launch self-exits on EADDRINUSE. Returns
 * the http URL to open, or null if bun is unavailable.
 */
async function ensureEvolutionServer({ rootDir }) {
  if (!commandExists('bun')) return null;
  const port = evolutionServerPort(rootDir);
  if (!(await portIsLive(port))) {
    // Detached so it outlives this `ga flow` process; a duplicate exits immediately.
    const child = spawn(
      'bun',
      ['run', 'src/main.ts', '--evolution-server'],
      {
        cwd: path.join(rootDir, 'scheme'),
        stdio: 'ignore',
        detached: true,
        env: { ...process.env, FLOW_ROOT_DIR: rootDir },
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

export async function runFlowCommand({ rootDir, options }) {
  if (!commandExists('zellij')) {
    throw new Error('Zellij is required. Install with: brew install zellij');
  }

  if (!options.skipDoctor) {
    const doctor = runDoctor({ rootDir });
    if (!doctor.ok) {
      throw new Error('Doctor checks failed. Run `ga doctor` to see actionable fixes.');
    }
  }

  // Do all async server setup + browser open BEFORE the blocking flow-run below
  // (spawnSync blocks the event loop, so awaited work must finish first).
  if (options.watch !== false) {
    // Live view is now served by a single per-project server that pushes updates
    // over WebSocket — no more per-flow file watchers competing over a shared file.
    // The server is a shared daemon; it survives this flow and self-exits when idle.
    console.log('📊 Starting evolution server…');
    const url = commandExists('bun') ? await ensureEvolutionServer({ rootDir }) : null;
    if (url) {
      console.log(`📊 Live evolution: ${url}  (disable with \`ga flow --no-watch\`)`);
      if (options.open !== false) openInBrowser(url);
    } else {
      // bun/server unavailable — fall back to a one-shot static file so there's still something to open.
      const outputPath = evolutionOutputPath(rootDir);
      exportEvolutionOnce({ rootDir, outputPath });
      if (options.open !== false) openInBrowser(outputPath);
    }
  }

  const scriptPath = path.join(rootDir, 'scripts', 'flow-run.sh');
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
