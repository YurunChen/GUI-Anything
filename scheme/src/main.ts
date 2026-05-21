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

  if (isLiveMode || isPostHoc) {
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
    console.log('  bun run src/main.ts --live             # Live observer (polls session JSONL)');
    console.log('  bun run src/main.ts --posthoc [path]   # Post-hoc analysis of latest session');
    console.log('  bun run src/main.ts --observer "<p>"   # Observer mode (for dual-pane)');
    console.log('  bun run src/main.ts --web              # Web API mode');
    console.log('');
    console.log('  # HTML Export:');
    console.log('  bun run src/main.ts --export-html -o replay.html');
    console.log('  bun run src/main.ts --export-html --session-id <id> --strip-thinking');
    console.log('  bun run src/main.ts --export-html --max-detail-length 500 --theme catppuccin');
    process.exit(1);
  }
}

main().catch(console.error);