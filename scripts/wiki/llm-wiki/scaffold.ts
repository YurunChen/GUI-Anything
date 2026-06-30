#!/usr/bin/env bun
/**
 * llm-wiki scaffold — knowledge meta + full entry tree for the current workspace.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', 'scaffold-knowledge-meta.sh');
const result = spawnSync('bash', [script], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
