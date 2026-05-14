#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDoctorReport, runDoctor } from './lib/doctor.mjs';
import { parseFlowArgs, runFlowCommand } from './lib/flow.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function printRootHelp() {
  console.log('ga - GUI-Anything CLI');
  console.log('');
  console.log('Usage:');
  console.log('  ga flow [--continue] [--resume [sessionId]] [--model <model>] [prompt]');
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
  console.log('  --backend <name>       auto|zellij|tmux (default: auto)');
  console.log('  --skip-doctor          Skip startup guardrails (not recommended)');
}

function main(argv) {
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
      return runFlowCommand({ rootDir, options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ga flow: ${message}`);
      console.error('Use `ga flow --help` for usage.');
      return 2;
    }
  }

  console.error(`Unknown command: ${command}`);
  printRootHelp();
  return 2;
}

const exitCode = main(process.argv.slice(2));
process.exit(exitCode);
