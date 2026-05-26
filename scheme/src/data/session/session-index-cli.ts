#!/usr/bin/env bun
/**
 * CLI for flow-run.sh — session index read/write and prefix resolution.
 * Usage:
 *   bun run src/data/session/session-index-cli.ts read --cwd <dir>
 *   bun run src/data/session/session-index-cli.ts write --cwd <dir> --session-id <id>
 *   bun run src/data/session/session-index-cli.ts resolve-prefix --cwd <dir> --prefix <p>
 */

import {
  matchIndexForWorkspace,
  resolveLastSessionId,
  touchLastSession,
} from './session-index';
import { resolveSessionByPrefix } from './claude-project';

function arg(name: string): string {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error(`Missing ${name}`);
    process.exit(2);
  }
  return process.argv[idx + 1];
}

const command = process.argv[2];

if (command === 'read') {
  const cwd = arg('--cwd');
  const sessionId = resolveLastSessionId(cwd);
  if (!sessionId) {
    process.exit(1);
  }
  console.log(sessionId);
  process.exit(0);
}

if (command === 'write') {
  const cwd = arg('--cwd');
  const sessionId = arg('--session-id');
  touchLastSession({ sessionId, cwd });
  process.exit(0);
}

if (command === 'resolve-prefix') {
  const cwd = arg('--cwd');
  const prefix = arg('--prefix');
  const result = resolveSessionByPrefix(prefix, cwd);
  if (result.status === 'found') {
    console.log(result.sessionId);
    process.exit(0);
  }
  if (result.status === 'ambiguous') {
    console.error('Ambiguous session prefix. Candidates:');
    for (const id of result.candidates) {
      console.error(`  ${id}`);
    }
    process.exit(2);
  }
  console.error(`No session matches prefix: ${prefix}`);
  process.exit(1);
}

console.error('Usage: session-index-cli.ts read|write|resolve-prefix ...');
process.exit(2);
