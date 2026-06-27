#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDoctorReport, runDoctor } from './lib/doctor.mjs';
import { parseFlowArgs, runFlowCommand } from './lib/flow.mjs';
import { runSessionsCommand } from './lib/sessions.mjs';
import { parseExportArgs, runExportCommand } from './lib/export.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function printRootHelp() {
  console.log('ga - GUI-Anything CLI');
  console.log('');
  console.log('Usage:');
  console.log('  ga flow [--continue] [--resume [sessionId]] [--model <model>] [prompt]');
  console.log('  ga sessions                          List captured session history');
  console.log('  ga export [-o <file>] [--no-ai] [--theme <t>] [--watch]');
  console.log('  ga doctor');
  console.log('');
  console.log('Notes:');
  console.log('  - `ga observer` is intentionally not exposed.');
  console.log('  - Internal observer runtime remains an implementation detail.');
}

function printFlowHelp() {
  console.log('ga flow');
  console.log('');
  console.log('Usage:');
  console.log('  ga flow');
  console.log('  ga flow --continue');
  console.log('  ga flow --resume');
  console.log('  ga flow --resume <sessionId>');
  console.log('  ga flow --model <model> [prompt]');
  console.log('');
  console.log('Options:');
  console.log('  -c, --continue         Continue the latest session');
  console.log('  -r, --resume [id]      Resume with picker or explicit session id');
  console.log('  -m, --model <model>    Claude model name');
  console.log('  --no-watch             Do not auto-refresh the evolution HTML while working');
  console.log('  --no-open              Do not auto-open the evolution HTML in a browser');
  console.log('  --skip-doctor          Skip startup guardrails (not recommended)');
  console.log('');
  console.log('By default, ga flow opens wiki/knowledge/outputs/evolution.html and keeps');
  console.log('it refreshed (deterministic) as you work. New projects open a placeholder');
  console.log('that turns into the timeline on the first milestone. Press `e` in the');
  console.log('observer for the AI-enriched version.');
}

function printExportHelp() {
  console.log('ga export');
  console.log('');
  console.log('Usage:');
  console.log('  ga export                       Export project evolution HTML (default path)');
  console.log('  ga export -o <file>             Write to a specific file');
  console.log('  ga export --watch               Re-export on every new/updated session bundle');
  console.log('');
  console.log('Options:');
  console.log('  -o, --output <file>    Output path (default: wiki/knowledge/outputs/evolution.html)');
  console.log('  --no-ai                Skip AI synthesis (deterministic fallback only)');
  console.log('  --theme <theme>        Theme name');
  console.log('  --session-id <id>      Single-session drill-down');
  console.log('  --scope <project|session>');
  console.log('  -w, --watch            Watch wiki/sessions and re-export on change');
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    printRootHelp();
    return 0;
  }

  if (command === 'doctor') {
    const report = runDoctor({ rootDir });
    console.log(formatDoctorReport(report));
    return report.ok ? 0 : 1;
  }

  if (command === 'flow') {
    try {
      const options = parseFlowArgs(rest);
      if (options.mode === 'help') {
        printFlowHelp();
        return 0;
      }
      return await runFlowCommand({ rootDir, options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ga flow: ${message}`);
      console.error('Use `ga flow --help` for usage.');
      return 2;
    }
  }

  if (command === 'sessions' || command === 'ls') {
    try {
      return runSessionsCommand({ rootDir });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ga sessions: ${message}`);
      return 2;
    }
  }

  if (command === 'export') {
    try {
      const options = parseExportArgs(rest);
      if (options.mode === 'help') {
        printExportHelp();
        return 0;
      }
      return runExportCommand({ rootDir, options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ga export: ${message}`);
      console.error('Use `ga export --help` for usage.');
      return 2;
    }
  }

  console.error(`Unknown command: ${command}`);
  printRootHelp();
  return 2;
}

main(process.argv.slice(2))
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
