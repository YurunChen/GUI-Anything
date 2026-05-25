#!/usr/bin/env bun
/**
 * Back-compat entry — delegates to maintain.ts --list-audits.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const maintain = path.join(root, 'scripts', 'wiki', 'llm-wiki', 'maintain.ts');
const result = spawnSync('bun', [maintain, '--list-audits'], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
});
process.exit(result.status ?? 1);
