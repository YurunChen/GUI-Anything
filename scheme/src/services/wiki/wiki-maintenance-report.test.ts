import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileKnowledgeAudit, listOpenAudits } from '../../data/wiki/knowledge-audit-service';
import {
  buildWikiMaintenanceReport,
  collectIntentBucketStats,
  maintenanceReportHasWork,
} from '../../services/wiki/wiki-maintenance-report';
import { listFlatContextFiles } from '../../data/wiki/knowledge-lint-core';

describe('wiki maintenance report', () => {
  let wikiRoot: string;

  beforeEach(() => {
    wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-report-'));
    const implement = path.join(wikiRoot, 'knowledge', 'contexts', 'implement');
    fs.mkdirSync(implement, { recursive: true });
    for (let i = 1; i <= 4; i++) {
      fs.writeFileSync(
        path.join(implement, `C00${i}-entry.md`),
        `---
id: "C00${i}"
slug: "entry-${i}"
request: "task ${i}"
type: "context"
tags: []
source:
  session_id: "s1"
  exploration_id: "e${i}"
---
body
`,
        'utf-8',
      );
    }
    fs.writeFileSync(
      path.join(wikiRoot, 'knowledge', 'contexts', 'C099-flat.md'),
      `---
id: "C099"
slug: "flat"
request: "flat legacy"
type: "context"
tags: []
source:
  session_id: "s1"
  exploration_id: "e9"
---
`,
      'utf-8',
    );
    fs.writeFileSync(path.join(wikiRoot, 'knowledge', 'index.md'), '# idx\nC001 C002 C003 C004 C099\n', 'utf-8');
    fileKnowledgeAudit({ targetId: 'C001', anchor: 'wrong summary' }, wikiRoot);
  });

  afterEach(() => {
    fs.rmSync(wikiRoot, { recursive: true, force: true });
  });

  it('lists open audits', () => {
    const open = listOpenAudits(wikiRoot);
    expect(open.length).toBe(1);
    expect(open[0].targetId).toBe('C001');
  });

  it('detects flat context files', () => {
    expect(listFlatContextFiles(wikiRoot)).toHaveLength(1);
  });

  it('flags bucket needing index', () => {
    const buckets = collectIntentBucketStats(wikiRoot);
    const implement = buckets.find((b) => b.intentKey === 'implement');
    expect(implement?.entryCount).toBe(4);
    expect(implement?.needsIndex).toBe(true);
  });

  it('builds combined report', () => {
    const report = buildWikiMaintenanceReport({ wikiRoot });
    expect(report.openAudits.length).toBe(1);
    expect(report.flatContextFiles.length).toBe(1);
    expect(report.summaryText).toContain('Open audits');
    expect(maintenanceReportHasWork(report)).toBe(true);
  });

  it('maintenanceReportHasWork is false for clean repo', () => {
    const cleanRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-clean-'));
    fs.mkdirSync(path.join(cleanRoot, 'knowledge', 'contexts', 'implement'), { recursive: true });
    fs.writeFileSync(
      path.join(cleanRoot, 'knowledge', 'contexts', 'implement', 'C001-ok.md'),
      '---\nid: "C001"\n---\nok',
      'utf-8',
    );
    fs.writeFileSync(path.join(cleanRoot, 'knowledge', 'index.md'), 'C001', 'utf-8');
    const report = buildWikiMaintenanceReport({ wikiRoot: cleanRoot });
    expect(maintenanceReportHasWork(report)).toBe(false);
    fs.rmSync(cleanRoot, { recursive: true, force: true });
  });
});
