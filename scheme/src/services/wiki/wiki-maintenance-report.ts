/**
 * Structured report for llm-wiki Phase 2 (audit + lint + intent bucket stats).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizeSessionIntentKey } from '../../constants/session-intent-keys';
import { listOpenAudits, type OpenKnowledgeAudit } from '../../data/wiki/knowledge-audit-service';
import {
  collectLintIssues,
  listFlatContextFiles,
  type KnowledgeLintResult,
  type LintIssue,
} from '../../data/wiki/knowledge-lint-core';
import { resolveWikiRoot } from '../../data/env';
import { wikiKnowledgeDir } from '../../data/wiki/wiki-data-layout';

const CONTEXT_ENTRY_RE = /^C\d{3}-.+\.md$/i;
const BUCKET_INDEX_THRESHOLD = 4;

export interface IntentBucketStat {
  intentKey: string;
  entryCount: number;
  hasIndex: boolean;
  needsIndex: boolean;
  sampleIds: string[];
}

export interface WikiMaintenanceReport {
  generatedAt: string;
  wikiRoot: string;
  openAudits: OpenKnowledgeAudit[];
  lint: KnowledgeLintResult;
  flatContextFiles: string[];
  intentBuckets: IntentBucketStat[];
  summaryText: string;
}

export interface BuildWikiMaintenanceReportOptions {
  wikiRoot?: string;
  intentFilter?: string[];
}

function parseIntentFilterFromEnv(): Set<string> | null {
  const raw = (process.env.FLOW_WIKI_MAINTAIN_INTENTS || '').trim();
  if (!raw) return null;
  return new Set(raw.split(/[,;\s]+/).map((part) => normalizeSessionIntentKey(part)).filter(Boolean));
}

function parseEntryId(filePath: string): string | null {
  const base = path.basename(filePath);
  const m = base.match(/^(C\d{3})-/i);
  return m ? m[1].toUpperCase() : null;
}

function countContextEntriesInDir(dir: string): { count: number; ids: string[] } {
  const ids: string[] = [];
  function walk(current: string): void {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && CONTEXT_ENTRY_RE.test(entry.name)) {
        const id = parseEntryId(full);
        if (id) ids.push(id);
      }
    }
  }
  walk(dir);
  return { count: ids.length, ids };
}

export function collectIntentBucketStats(wikiRoot: string): IntentBucketStat[] {
  const contextsDir = path.join(wikiKnowledgeDir(wikiRoot), 'contexts');
  if (!fs.existsSync(contextsDir)) return [];

  const buckets: IntentBucketStat[] = [];

  for (const entry of fs.readdirSync(contextsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const intentKey = entry.name;
    const bucketDir = path.join(contextsDir, intentKey);
    const { count, ids } = countContextEntriesInDir(bucketDir);
    if (count === 0) continue;
    const hasIndex = fs.existsSync(path.join(bucketDir, 'index.md'));
    buckets.push({
      intentKey,
      entryCount: count,
      hasIndex,
      needsIndex: count >= BUCKET_INDEX_THRESHOLD && !hasIndex,
      sampleIds: ids.slice(0, 5),
    });
  }

  buckets.sort((a, b) => b.entryCount - a.entryCount);
  return buckets;
}

function formatSummary(
  openAudits: OpenKnowledgeAudit[],
  lint: KnowledgeLintResult,
  flatContextFiles: string[],
  intentBuckets: IntentBucketStat[],
): string {
  const lines: string[] = [
    '【Wiki 维护报告】',
    `open_audits: ${openAudits.length}`,
    `lint: ${lint.errorCount} error(s), ${lint.warnCount} warning(s)`,
    `flat_context_files: ${flatContextFiles.length}`,
    `intent_buckets: ${intentBuckets.length}`,
    '',
  ];

  if (openAudits.length > 0) {
    lines.push('## Open audits');
    for (const audit of openAudits) {
      lines.push(`- ${audit.fileName} → ${audit.targetId} (${audit.severity})`);
      if (audit.anchorExcerpt) lines.push(`  anchor: ${audit.anchorExcerpt.slice(0, 120)}`);
    }
    lines.push('');
  }

  if (lint.issues.length > 0) {
    lines.push('## Lint issues');
    for (const issue of lint.issues.slice(0, 30)) {
      lines.push(`- [${issue.level}] ${issue.message}`);
    }
    if (lint.issues.length > 30) {
      lines.push(`- … and ${lint.issues.length - 30} more`);
    }
    lines.push('');
  }

  if (flatContextFiles.length > 0) {
    lines.push('## Legacy flat contexts/ (migrate to contexts/{intent_key}/)');
    for (const file of flatContextFiles.slice(0, 20)) {
      lines.push(`- ${path.basename(file)}`);
    }
    lines.push('');
  }

  const needsIndex = intentBuckets.filter((b) => b.needsIndex);
  if (needsIndex.length > 0) {
    lines.push('## Buckets needing index.md');
    for (const bucket of needsIndex) {
      lines.push(`- ${bucket.intentKey}: ${bucket.entryCount} entries`);
    }
    lines.push('');
  }

  if (intentBuckets.length > 0) {
    lines.push('## Intent bucket counts');
    for (const bucket of intentBuckets) {
      lines.push(`- ${bucket.intentKey}: ${bucket.entryCount}${bucket.hasIndex ? ' (has index)' : ''}`);
    }
  }

  return lines.join('\n');
}

/** True when Phase 2 maintain has actionable work (not a clean repo). */
export function maintenanceReportHasWork(report: WikiMaintenanceReport): boolean {
  if (report.openAudits.length > 0) return true;
  if (report.lint.errorCount > 0) return true;
  if (report.flatContextFiles.length > 0) return true;
  if (report.intentBuckets.some((b) => b.needsIndex)) return true;
  if (report.lint.warnCount > 0) return true;
  return false;
}

export function buildWikiMaintenanceReport(
  options: BuildWikiMaintenanceReportOptions = {},
): WikiMaintenanceReport {
  const wikiRoot = options.wikiRoot ?? resolveWikiRoot();
  const intentFilter = options.intentFilter
    ?? (parseIntentFilterFromEnv() ? [...parseIntentFilterFromEnv()!] : undefined);

  const openAudits = listOpenAudits(wikiRoot);
  const lint = collectLintIssues(wikiRoot);
  const flatContextFiles = listFlatContextFiles(wikiRoot);
  let intentBuckets = collectIntentBucketStats(wikiRoot);

  if (intentFilter?.length) {
    const allowed = new Set(intentFilter.map((k) => normalizeSessionIntentKey(k)));
    intentBuckets = intentBuckets.filter((b) => allowed.has(normalizeSessionIntentKey(b.intentKey)));
  }

  return {
    generatedAt: new Date().toISOString(),
    wikiRoot,
    openAudits,
    lint,
    flatContextFiles,
    intentBuckets,
    summaryText: formatSummary(openAudits, lint, flatContextFiles, intentBuckets),
  };
}

export type { LintIssue, KnowledgeLintResult, OpenKnowledgeAudit };
