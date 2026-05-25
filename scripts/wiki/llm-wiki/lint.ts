#!/usr/bin/env bun
/**
 * llm-wiki lint — delegates to knowledge-lint with GUI-Anything knowledge tree.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const lintScript = path.join(here, '..', 'knowledge-lint.ts');
const result = spawnSync(process.execPath, [lintScript], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
