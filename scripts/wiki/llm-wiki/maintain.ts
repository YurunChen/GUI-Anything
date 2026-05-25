#!/usr/bin/env bun
/**
 * llm-wiki Phase 2 — unified wiki maintenance CLI (report, audits, agent).
 *
 * Usage:
 *   bun run scripts/wiki/llm-wiki/maintain.ts --help
 *   bun run scripts/wiki/llm-wiki/maintain.ts --list-audits
 *   bun run scripts/wiki/llm-wiki/maintain.ts --dry-run
 *   bun run scripts/wiki/llm-wiki/maintain.ts --json
 *   bun run scripts/wiki/llm-wiki/maintain.ts
 */

import { formatAuditListing } from '../../../scheme/src/data/wiki/knowledge-audit-service';
import { buildWikiMaintenanceReport } from '../../../scheme/src/services/wiki/wiki-maintenance-report';
import { runWikiMaintainPipeline } from '../../../scheme/src/services/wiki/wiki-maintain-service';

const HELP = `llm-wiki Phase 2 — wiki knowledge maintenance (single CLI entry)

Usage:
  bun run scripts/wiki/llm-wiki/maintain.ts [options]
  ./scripts/wiki/wiki-maintain.sh [options]

Options:
  --list-audits   List open audits (severity, target_id) and resolved filings; exit 0
  --dry-run       Print maintenance report (audits + lint + buckets); no agent
  --json          Print maintenance report as JSON; no agent
  --help          Show this help

Default: run /llm-wiki Phase 2 maintain agent (ingest Phase 1 first if digest in prompt).
Env: FLOW_WIKI_MAINTAIN=0, FLOW_WIKI_MAINTAIN_PRINT_ONLY=1, FLOW_WIKI_MAINTAIN_INTENTS=...
`;

const args = process.argv.slice(2);

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(HELP.trimEnd());
    process.exit(0);
  }

  if (hasFlag('--list-audits')) {
    console.log(formatAuditListing());
    process.exit(0);
  }

  const dryRun = hasFlag('--dry-run');
  const jsonOnly = hasFlag('--json');

  const report = buildWikiMaintenanceReport();

  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  if (dryRun) {
    console.log(report.summaryText);
    console.log('');
    console.log(`Lint: ${report.lint.errorCount} error(s), ${report.lint.warnCount} warning(s)`);
    console.log(`Open audits: ${report.openAudits.length}`);
    console.log(`Flat context files: ${report.flatContextFiles.length}`);
    process.exit(0);
  }

  const result = await runWikiMaintainPipeline(report);
  if (!result.ok) {
    console.error(`Maintain failed: ${result.reason ?? 'unknown'}`);
    if (result.manifest) {
      console.error(JSON.stringify(result.manifest, null, 2));
    }
    process.exit(1);
  }

  console.log(`Maintain OK: audits=${result.auditsResolved.length} moved=${result.filesMoved} merged=${result.entriesMerged}`);
  if (result.manifest) {
    console.log(`action=${result.manifest.action} reason=${result.manifest.reason}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
