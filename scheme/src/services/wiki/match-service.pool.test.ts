import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { KnowledgeRepository } from '../../data/wiki/knowledge-repository';
import { DefaultWikiMatchService } from './match-service';

function writeEntry(
  wikiRoot: string,
  subdir: string,
  id: string,
  slug: string,
  request: string,
  type: string,
): void {
  const dir = path.join(wikiRoot, 'knowledge', subdir);
  fs.mkdirSync(dir, { recursive: true });
  const content = `---
id: "${id}"
slug: "${slug}"
request: "${request}"
type: "${type}"
tags: []
---
## 摘要
${request} body
`;
  fs.writeFileSync(path.join(dir, `${id}-${slug}.md`), content, 'utf-8');
}

describe('match pool excludes summaries/', () => {
  let tmpDir: string;
  let originalWikiDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-match-'));
    originalWikiDir = process.env.FLOW_WIKI_DIR;
    process.env.FLOW_WIKI_DIR = tmpDir;
    writeEntry(tmpDir, 'contexts', 'C001', 'main-topic', '分析下当前的项目', 'context');
    writeEntry(tmpDir, 'summaries', 'C099', 'dup-summary', '分析下当前的项目', 'context');
  });

  afterEach(() => {
    if (originalWikiDir !== undefined) {
      process.env.FLOW_WIKI_DIR = originalWikiDir;
    } else {
      delete process.env.FLOW_WIKI_DIR;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prior-hit search returns main entry not summaries/', () => {
    const repo = new KnowledgeRepository(tmpDir);
    const service = new DefaultWikiMatchService(repo);
    const hit = service.searchByQuerySync('分析下当前的项目', 0.3);
    expect(hit?.entry.id).toBe('C001');
  });

  it('listMatchPoolSync excludes summaries', () => {
    const repo = new KnowledgeRepository(tmpDir);
    const pool = repo.listMatchPoolSync();
    expect(pool.some((e) => e.id === 'C001')).toBe(true);
    expect(pool.some((e) => e.id === 'C099')).toBe(false);
  });

  it('listMatchPoolSync ignores legacy errors/ dir', () => {
    writeEntry(tmpDir, 'errors', 'E001', 'legacy-error', '旧错误笔记', 'context');
    const repo = new KnowledgeRepository(tmpDir);
    const pool = repo.listMatchPoolSync();
    expect(pool.some((e) => e.id === 'E001')).toBe(false);
    expect(pool.some((e) => e.id === 'C001')).toBe(true);
  });
});
