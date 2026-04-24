import { startWebServer } from './ui/server';

async function main() {
  const args = Bun.argv.slice(2);
  const isWebMode = args.includes('--web');
  const isObserverMode = args.includes('--observer');
  const isFlowMode = args.includes('--flow');
  const isLiveMode = args.includes('--live');
  const isPostHoc = args.includes('--posthoc');
  const prompt = args.filter(a => !a.startsWith('--')).join(' ').trim();

  if (isLiveMode || isPostHoc) {
    const { renderLiveObserver } = await import('./ui/tui/live-observer');
    const cwd = process.cwd();
    await renderLiveObserver(cwd);
  } else if (isWebMode) {
    const port = parseInt(process.env.PORT || '3000');
    await startWebServer(port, isFlowMode);
    console.log(`Web API listening on http://localhost:${port}${isFlowMode ? ' (flow mode)' : ''}`);
    await new Promise(() => {});
  } else if ((isObserverMode || isFlowMode) && prompt) {
    const { renderTUI } = await import('./ui/tui/index');
    await renderTUI(prompt, isFlowMode);
  } else if (prompt) {
    const { renderTUI } = await import('./ui/tui/index');
    await renderTUI(prompt, false);
  } else {
    console.log('Usage:');
    console.log('  bun run src/main.ts "<prompt>"         # Direct mode (Claude runs once)');
    console.log('  bun run src/main.ts --flow "<prompt>"  # Flow mode (persistent + timeline view)');
    console.log('  bun run src/main.ts --live             # Live observer (polls session JSONL)');
    console.log('  bun run src/main.ts --posthoc [path]   # Post-hoc analysis of latest session');
    console.log('  bun run src/main.ts --observer "<p>"   # Observer mode (for dual-pane)');
    console.log('  bun run src/main.ts --web              # Web API mode');
    process.exit(1);
  }
}

main().catch(console.error);
