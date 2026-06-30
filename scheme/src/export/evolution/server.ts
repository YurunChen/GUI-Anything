/**
 * Project Evolution — live server.
 *
 * One long-lived process per project holds the evolution model in memory, watches
 * wiki/sessions/, and pushes a fresh snapshot to connected browsers over WebSocket
 * (the page re-renders in place, no reload). This replaces the old "every flow spawns
 * a watcher that writes a shared HTML file + the page polls a .version.js sidecar"
 * design, which had no single-writer guarantee and let orphaned watchers running stale
 * code overwrite the page.
 *
 * Single-writer is enforced by the port: the port is derived deterministically from the
 * project root, so a second instance hits EADDRINUSE and exits — no pidfile race.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildEvolutionModel } from './export-evolution';
import { generateEvolutionHtml } from './template';
import { watchSessionsDir } from '../../data/wiki/wiki-watch';
import { personaAvatarFile } from './persona-avatar';
import type { EvolutionExport } from '../../data/protocol/evolution-types';
import { resolveObserverLocale } from '../../constants/observer-locale';
import { evolutionServerPort, resolveEvolutionServerRoot } from './port';

export { evolutionServerPort } from './port';

export interface StartEvolutionServerOptions {
  rootDir?: string;
  port?: number;
  /** Self-exit after this long with zero connected clients (default 30 min). */
  idleMs?: number;
}

/** Minimal valid model for an empty project, so the live client still connects and
 *  auto-upgrades in place once the first milestone lands. */
function emptyModel(root: string): EvolutionExport {
  return {
    version: '1.0',
    locale: resolveObserverLocale(),
    generatedAt: Date.now(),
    aiUsed: false,
    project: {
      workspaceRoot: root,
      eras: [],
      nodes: [],
      metrics: { toolCount: 0, errorCount: 0, retrievals: 0, writes: 0, interrupted: 0 },
    },
    sessions: [],
    liveServer: true,
    contentVersion: 'empty',
    generatedBy: { agent: 'GUI-Anything · Flow Observer', builtAt: Date.now() },
  };
}

export async function startEvolutionServer(options: StartEvolutionServerOptions = {}): Promise<void> {
  const root = resolveEvolutionServerRoot(options.rootDir);
  const wikiRoot = path.join(root, 'wiki');
  const port = options.port || evolutionServerPort(root);
  const idleMs = options.idleMs ?? Number(process.env.EVO_SERVER_IDLE_MS || 30 * 60 * 1000);
  const infoPath = path.join(wikiRoot, 'knowledge', 'outputs', '.evolution-server.json');

  let currentHtml = '';
  let currentSnapshot = '';
  let currentVersion = '';

  async function rebuild(): Promise<boolean> {
    const data =
      (await buildEvolutionModel({ wikiRoot, workspaceRoot: root, noAi: true, liveServer: true })) ||
      emptyModel(root);
    const v = data.contentVersion || 'empty';
    if (v === currentVersion) return false;
    currentVersion = v;
    currentHtml = generateEvolutionHtml(data);
    currentSnapshot = JSON.stringify({ type: 'snapshot', data });
    return true;
  }

  await rebuild();

  const clients = new Set<any>();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  function armIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (clients.size === 0) shutdown('idle');
    }, idleMs);
  }

  let server: ReturnType<typeof Bun.serve> | null = null;
  try {
    server = Bun.serve({
      port,
      fetch(req, srv) {
        const url = new URL(req.url);
        if (url.pathname === '/ws') {
          // We store nothing on the socket; pass an explicit empty data option to
          // satisfy Bun's typed upgrade() (data generic is unknown here).
          return srv.upgrade(req, { data: undefined })
            ? undefined
            : new Response('WebSocket upgrade failed', { status: 400 });
        }
        if (url.pathname === '/' || url.pathname === '/index.html') {
          return new Response(currentHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        // Persona avatars: /persona/<CODE>.webp → served from the generated avatar dir.
        const avatarMatch = url.pathname.match(/^\/persona\/([A-Za-z0-9_-]{1,16})\.webp$/);
        if (avatarMatch) {
          const file = personaAvatarFile(avatarMatch[1]);
          if (file) {
            return new Response(Bun.file(file), { headers: { 'Content-Type': 'image/webp' } });
          }
          return new Response('avatar not found', { status: 404 });
        }
        if (url.pathname === '/api/health') {
          return new Response(
            JSON.stringify({ ok: true, root, port, version: currentVersion, clients: clients.size }),
            { headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('Not found', { status: 404 });
      },
      websocket: {
        open(ws) {
          clients.add(ws);
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
          try {
            ws.send(currentSnapshot);
          } catch {
            // best-effort
          }
        },
        message(ws, msg) {
          if (msg === 'ping') ws.send('pong');
        },
        close(ws) {
          clients.delete(ws);
          if (clients.size === 0) armIdle();
        },
      },
    });
  } catch {
    // Port already bound → another server already owns this project. Single-writer via port.
    console.error(`evolution server: port ${port} busy — another instance owns ${root}; exiting.`);
    process.exit(0);
  }

  // Discovery file so `ga flow` / tooling can find the live server for this project.
  try {
    fs.mkdirSync(path.dirname(infoPath), { recursive: true });
    fs.writeFileSync(
      infoPath,
      JSON.stringify({ pid: process.pid, port, root, startedAt: Date.now() }),
      'utf-8',
    );
  } catch {
    // best-effort
  }

  // Watch wiki/sessions and push a snapshot only when the content actually changed.
  let building = false;
  let pending = false;
  const onChange = async (): Promise<void> => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try {
      const changed = await rebuild();
      if (changed && clients.size) {
        for (const ws of clients) {
          try {
            ws.send(currentSnapshot);
          } catch {
            clients.delete(ws);
          }
        }
      }
    } catch (e) {
      console.error('evolution rebuild failed:', e instanceof Error ? e.message : String(e));
    }
    building = false;
    if (pending) {
      pending = false;
      void onChange();
    }
  };
  const handle = watchSessionsDir(() => void onChange(), { wikiRoot });

  // Remove the discovery file on ANY exit path (signals, idle, crash). 'exit'
  // handlers must be synchronous — rmSync fits. This is the reliable last resort.
  let cleaned = false;
  function removeInfoFile(): void {
    if (cleaned) return;
    cleaned = true;
    try {
      fs.rmSync(infoPath, { force: true });
    } catch {
      // best-effort
    }
  }
  process.on('exit', removeInfoFile);

  function shutdown(reason: string): void {
    try {
      handle.close();
    } catch {
      // best-effort
    }
    try {
      server?.stop();
    } catch {
      // best-effort
    }
    removeInfoFile();
    console.error(`evolution server: shutting down (${reason}).`);
    process.exit(0);
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  armIdle();
  console.error(`📡 Evolution server: http://localhost:${port}/  (root=${root}, version=${currentVersion})`);
  await new Promise<void>(() => {}); // keep alive
}
