import { startWebServer } from './app/server';
import type { ProjectEvolutionRaw, SessionEvolutionRaw } from './data/protocol/evolution-types';

/** Milestone count mirroring buildSessionNodes: first revision + each pivot. */
function milestoneCount(session: SessionEvolutionRaw): number {
  let n = 0;
  let first = true;
  for (const rev of session.revisions) {
    if (rev.delta === 'pivot' || first) n += 1;
    first = false;
  }
  return n;
}

function fmtDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function listSessions(): Promise<void> {
  const { defaultProjectEvolutionRepository } = await import('./data/wiki/project-evolution-repository');
  const { filterNoiseSessions } = await import('./services/evolution/evolution-service');
  const repo = defaultProjectEvolutionRepository();
  const raw: ProjectEvolutionRaw = repo.loadProjectEvolution();
  const meaningful = new Set(filterNoiseSessions(raw).sessions.map((s) => s.sessionId));

  if (raw.sessions.length === 0) {
    console.log('No sessions found. Run `ga flow` to start capturing.');
    return;
  }

  const rows = [...raw.sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((s) => ({
      id: s.sessionId.slice(0, 8),
      date: fmtDate(s.updatedAt),
      nodes: meaningful.has(s.sessionId) ? String(milestoneCount(s)) : '·',
      intent: s.revisions[0]?.intentKey ?? '',
      title: s.title.replace(/\s+/g, ' ').trim(),
    }));

  const w = (key: 'id' | 'date' | 'nodes' | 'intent', head: string) =>
    Math.max(head.length, ...rows.map((r) => r[key].length));
  const wId = w('id', 'ID');
  const wDate = w('date', 'DATE');
  const wNodes = w('nodes', 'NODES');
  const wIntent = w('intent', 'INTENT');

  console.log(`Sessions for ${raw.workspaceRoot} (${rows.length}):\n`);
  console.log(
    `  ${'ID'.padEnd(wId)}  ${'DATE'.padEnd(wDate)}  ${'NODES'.padEnd(wNodes)}  ${'INTENT'.padEnd(wIntent)}  TITLE`,
  );
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(wId)}  ${r.date.padEnd(wDate)}  ${r.nodes.padEnd(wNodes)}  ${r.intent.padEnd(wIntent)}  ${r.title}`,
    );
  }
  console.log('\nResume:  ga flow --resume <ID>');
  console.log('Export:  ga export   (· = trivial/no milestones)');
}

async function main() {
  const args = Bun.argv.slice(2);
  const isWebMode = args.includes('--web');
  const isObserverMode = args.includes('--observer');
  const isFlowMode = args.includes('--flow');
  const isLiveMode = args.includes('--live');
  const isPostHoc = args.includes('--posthoc');
  const isExportHtml = args.includes('--export-html');
  const isThemePlayground = args.includes('--theme-playground');
  const isKnowledgeGraph = args.includes('--knowledge-graph');
  const prompt = args.filter(a => !a.startsWith('--') && !a.startsWith('-o')).join(' ').trim();

  // ─── Web Mirror Mode ───
  const isWebMirror = args.includes('--web-mirror');
  if (isWebMirror) {
    const { startWebMirror } = await import('./export/web-mirror/ws-server');
    const portIdx = args.indexOf('--port');
    const port = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : undefined;
    startWebMirror({ port });
    await new Promise(() => {}); // Keep alive
    return;
  }

  // ─── Knowledge Graph ───
  if (isKnowledgeGraph) {
    const { exportKnowledgeGraph } = await import('./export/knowledge-graph/generate-graph');
    const outputIdx = args.indexOf('-o');
    const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;
    const sinceIdx = args.indexOf('--since');
    const since = sinceIdx >= 0 ? args[sinceIdx + 1] : undefined;
    await exportKnowledgeGraph({ outputPath, since });
    return;
  }

  // ─── Session history listing ───
  if (args.includes('--list-sessions')) {
    await listSessions();
    return;
  }

  // ─── Project Evolution live server (single per-project; WS push) ───
  if (args.includes('--evolution-server')) {
    const { startEvolutionServer } = await import('./export/evolution/server');
    const portIdx = args.indexOf('--port');
    const port = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : undefined;
    await startEvolutionServer({ rootDir: process.env.FLOW_ROOT_DIR, port });
    return;
  }

  // ─── Project Evolution HTML Export (static, self-contained file) ───
  if (isExportHtml) {
    const { exportEvolutionToHtml } = await import('./export/evolution/export-evolution');
    const argValue = (flag: string): string | undefined => {
      const idx = args.indexOf(flag);
      return idx >= 0 ? args[idx + 1] : undefined;
    };
    const scopeArg = argValue('--scope');
    const exportOpts = {
      outputPath: argValue('-o'),
      sessionId: argValue('--session-id'),
      scope: (scopeArg === 'session' ? 'session' : 'project') as 'session' | 'project',
      noAi: args.includes('--no-ai'),
      theme: argValue('--theme'),
    };
    await exportEvolutionToHtml(exportOpts);

    // --watch: keep the static file fresh on bundle changes (no live-reload sidecar;
    // the live in-browser experience is the evolution server above).
    if (args.includes('--watch')) {
      const { watchSessionsDir } = await import('./data/wiki/wiki-watch');
      let running = false;
      let pending = false;
      const rerun = async () => {
        if (running) { pending = true; return; }
        running = true;
        try {
          await exportEvolutionToHtml(exportOpts);
        } catch (err) {
          console.error('re-export failed:', err instanceof Error ? err.message : String(err));
        }
        running = false;
        if (pending) { pending = false; void rerun(); }
      };
      const handle = watchSessionsDir(() => void rerun());
      console.error('👀 Watching wiki/sessions for changes… (Ctrl-C to stop)');
      process.on('SIGINT', () => {
        handle.close();
        process.exit(0);
      });
      await new Promise(() => {});
    }
    return;
  }

  if (isPostHoc) {
    console.error('Removed: --posthoc tree view. Use dual-pane flow (`ga flow`) or `bun run src/main.ts --live` for the live observer.');
    process.exit(1);
  }

  if (isLiveMode || isObserverMode) {
    const { renderLiveObserver } = await import('./app/ui/live-observer');
    const cwd = process.cwd();
    await renderLiveObserver(cwd);
  } else if (isWebMode) {
    const port = parseInt(process.env.PORT || '3000');
    await startWebServer(port, isFlowMode);
    console.log(`Web API listening on http://localhost:${port}${isFlowMode ? ' (flow mode)' : ''}`);
    await new Promise(() => {});
  } else if ((isObserverMode || isFlowMode) && prompt) {
    const { renderTUI } = await import('./app/ui/index');
    await renderTUI(prompt, isFlowMode);
  } else if (prompt) {
    const { renderTUI } = await import('./app/ui/index');
    await renderTUI(prompt, false);
  } else {
    console.log('Usage:');
    console.log('  bun run src/main.ts "<prompt>"         # Direct mode (Claude runs once)');
    console.log('  bun run src/main.ts --flow "<prompt>"  # Flow mode (persistent + timeline view)');
    console.log('  bun run src/main.ts --live             # Live observer (dual-pane right pane; same as --observer)');
    console.log('  bun run src/main.ts --observer         # Alias for --live');
    console.log('  bun run src/main.ts --web              # Web API mode');
    console.log('');
    console.log('  # Project Evolution HTML (intent 演进史):');
    console.log('  bun run src/main.ts --export-html -o evolution.html               # 项目总览（默认，跨 session）');
    console.log('  bun run src/main.ts --export-html --scope session --session-id <id> -o evo.html  # 单 session 下钻');
    console.log('  bun run src/main.ts --export-html --no-ai --theme catppuccin       # 跳过 AI，规则合成主线');
    console.log('');
    console.log('  # Web Mirror (real-time browser viewer):');
    console.log('  bun run src/main.ts --web-mirror');
    console.log('  bun run src/main.ts --web-mirror --port 8080');
    process.exit(1);
  }
}

main().catch(console.error);