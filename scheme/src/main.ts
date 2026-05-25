import { startWebServer } from './app/server';

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

  // ─── HTML Export Modes ───
  if (isExportHtml) {
    const { exportSessionToHtml } = await import('./export/html-replay/export-html');
    const outputIdx = args.indexOf('-o');
    const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;
    const sessionIdIdx = args.indexOf('--session-id');
    const sessionId = sessionIdIdx >= 0 ? args[sessionIdIdx + 1] : undefined;

    await exportSessionToHtml({
      outputPath,
      sessionId,
      stripThinking: args.includes('--strip-thinking'),
      maxDetailLength: (() => {
        const idx = args.indexOf('--max-detail-length');
        return idx >= 0 ? parseInt(args[idx + 1], 10) : undefined;
      })(),
      withSummaries: args.includes('--with-summaries'),
      theme: (() => {
        const idx = args.indexOf('--theme');
        return idx >= 0 ? args[idx + 1] : undefined;
      })(),
    });
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
    console.log('  # HTML Export:');
    console.log('  bun run src/main.ts --export-html -o replay.html');
    console.log('  bun run src/main.ts --export-html --session-id <id> --strip-thinking');
    console.log('  bun run src/main.ts --export-html --max-detail-length 500 --theme catppuccin');
    console.log('');
    console.log('  # Web Mirror (real-time browser viewer):');
    console.log('  bun run src/main.ts --web-mirror');
    console.log('  bun run src/main.ts --web-mirror --port 8080');
    process.exit(1);
  }
}

main().catch(console.error);