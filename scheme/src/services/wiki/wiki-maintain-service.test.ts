import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileKnowledgeAudit, resolveKnowledgeAudit } from '../../data/wiki/knowledge-audit-service';
import { KnowledgeRepository } from '../../data/wiki/knowledge-repository';
import { applyWikiMaintainManifest } from './wiki-maintain-service';

describe('applyWikiMaintainManifest', () => {
  let wikiRoot: string;
  let auditFileName: string;

  beforeEach(() => {
    wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-maintain-'));
    const contexts = path.join(wikiRoot, 'knowledge', 'contexts', 'debug');
    fs.mkdirSync(contexts, { recursive: true });
    fs.writeFileSync(
      path.join(contexts, 'C001-target.md'),
      `---
id: "C001"
slug: "target"
request: "fix tests"
type: "context"
tags: []
source:
  session_id: "s1"
  exploration_id: "e1"
---
## 摘要
old

## 解决方案
old solution
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(contexts, 'C003-dup.md'),
      `---
id: "C003"
slug: "dup"
request: "fix tests"
type: "context"
tags: []
source:
  session_id: "s1"
  exploration_id: "e3"
---
dup body
`,
      'utf-8',
    );
    fs.writeFileSync(path.join(wikiRoot, 'knowledge', 'index.md'), '# idx\nC001 C003\n', 'utf-8');

    const filed = fileKnowledgeAudit({ targetId: 'C001', anchor: 'bad' }, wikiRoot);
    auditFileName = path.basename(filed.path);
  });

  afterEach(() => {
    fs.rmSync(wikiRoot, { recursive: true, force: true });
  });

  it('resolves audits from manifest', async () => {
    const repo = new KnowledgeRepository(wikiRoot);
    const result = await applyWikiMaintainManifest({
      action: 'apply',
      reason: 'audit fixed',
      audits_resolved: [auditFileName],
    }, repo);

    expect(result.ok).toBe(true);
    expect(result.auditsResolved).toEqual([auditFileName]);
    expect(fs.existsSync(path.join(wikiRoot, 'knowledge', 'audit', auditFileName))).toBe(false);
    expect(fs.existsSync(path.join(wikiRoot, 'knowledge', 'audit', 'resolved', auditFileName))).toBe(true);
  });

  it('stamps merged_into on slave entries', async () => {
    const repo = new KnowledgeRepository(wikiRoot);
    const result = await applyWikiMaintainManifest({
      action: 'apply',
      reason: 'merge dup',
      files_written: ['knowledge/contexts/debug/C001-target.md'],
      entries_merged: [{ keep_id: 'C001', remove_ids: ['C003'] }],
    }, repo);

    expect(result.ok).toBe(true);
    expect(result.entriesMerged).toBe(1);
    const slave = await repo.findById('C003');
    expect(slave?.content).toContain('merged_into');
  });

  it('resolveKnowledgeAudit moves file to resolved', () => {
    const open = path.join(wikiRoot, 'knowledge', 'audit', auditFileName);
    expect(fs.existsSync(open)).toBe(true);
    const r = resolveKnowledgeAudit(auditFileName, wikiRoot, 'accepted test fix');
    expect(r.ok).toBe(true);
    expect(fs.existsSync(open)).toBe(false);
    const resolved = fs.readFileSync(path.join(wikiRoot, 'knowledge', 'audit', 'resolved', auditFileName), 'utf-8');
    expect(resolved).toContain('# Resolution');
    expect(resolved).toContain('accepted test fix');
  });
});
