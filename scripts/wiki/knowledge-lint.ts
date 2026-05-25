#!/usr/bin/env bun
/**
 * knowledge-lint — verify index consistency and basic hygiene (recursive contexts/**).
 */

import * as path from 'node:path';
import { collectLintIssues } from '../../scheme/src/data/wiki/knowledge-lint-core';

const root = process.env.FLOW_WIKI_DIR
  ?? path.join(process.env.FLOW_ROOT_DIR ?? process.cwd(), 'wiki');

const result = collectLintIssues(root);

for (const i of result.issues) {
  console.log(`${i.level.toUpperCase()}: ${i.message}`);
}

console.log(`\nMatch pool: ${result.matchPoolCount} entries (summaries excluded from UI search)`);
console.log(`Checked ${result.indexedCount} indexed entries — ${result.errorCount} error(s), ${result.warnCount} warning(s)`);
process.exit(result.errorCount > 0 ? 1 : 0);
