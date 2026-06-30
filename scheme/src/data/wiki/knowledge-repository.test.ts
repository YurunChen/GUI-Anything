import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { allocateId } from './knowledge-normalize';
import {
  collectKnowledgeIds,
  KnowledgeRepository,
  knowledgeEntryWikiPath,
} from './knowledge-repository';

describe('KnowledgeRepository', () => {
  let wikiRoot: string;
  let repo: KnowledgeRepository;

  beforeEach(() => {
    wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-repo-'));
    repo = new KnowledgeRepository(wikiRoot);
  });

  afterEach(() => {
    fs.rmSync(wikiRoot, { recursive: true, force: true });
  });

  it('collectKnowledgeIds includes summaries/', () => {
    const summDir = path.join(wikiRoot, 'knowledge', 'summaries');
    fs.mkdirSync(summDir, { recursive: true });
    fs.writeFileSync(
      path.join(summDir, 'C099-dup.md'),
      '---\nid: "C099"\n---\n',
      'utf-8',
    );
    const ids = collectKnowledgeIds(wikiRoot);
    expect(ids).toContain('C099');
    expect(nextContextId(wikiRoot)).toBe('C100');
  });

  it('save update preserves nested relativePath', async () => {
    const nested = path.join(wikiRoot, 'knowledge', 'contexts', 'topic', 'C001-nested.md');
    fs.mkdirSync(path.dirname(nested), { recursive: true });
    fs.writeFileSync(
      nested,
      `---
id: "C001"
slug: "nested"
request: "q"
type: "context"
category: "contexts"
tags: []
source:
  session_id: "s1"
  exploration_id: "e1"
extraction_confidence: 0.8
created: "2026-01-01T00:00:00.000Z"
---
old body
`,
      'utf-8',
    );

    const existing = await repo.findById('C001');
    expect(existing?.relativePath).toBe('knowledge/contexts/topic/C001-nested.md');

    const updated = {
      ...existing!,
      content: existing!.content.replace('old body', 'new body'),
    };
    const saved = await repo.save(updated, { overwrite: true });
    expect(saved.success).toBe(true);
    expect(fs.existsSync(nested)).toBe(true);
    expect(fs.readFileSync(nested, 'utf-8')).toContain('new body');
    expect(
      fs.existsSync(path.join(wikiRoot, 'knowledge', 'contexts', 'C001-nested.md')),
    ).toBe(false);
  });

  it('parses inline tags', async () => {
    const file = path.join(wikiRoot, 'knowledge', 'contexts', 'C003-inline-tags.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      `---
id: "C003"
slug: "inline-tags"
request: "q"
type: "context"
tags: ["scope:global", "intent:wiki"]
source:
  session_id: "s1"
  exploration_id: "e1"
---
body
`,
      'utf-8',
    );

    const entry = await repo.findById('C003');
    expect(entry?.tags).toEqual(['scope:global', 'intent:wiki']);
  });

  it('save new context entry under intent_key bucket when provided', async () => {
    const saved = await repo.save({
      id: 'C010',
      slug: 'bucket-test',
      sessionId: 's1',
      explorationId: 'e1',
      type: 'context',
      request: 'implement feature',
      content: `---
id: "C010"
slug: "bucket-test"
request: "implement feature"
type: "context"
category: "contexts"
tags: []
source:
  session_id: "s1"
  exploration_id: "e1"
intent_key: "implement"
---
body
`,
      confidence: 0.8,
      tags: [],
      createdAt: Date.now(),
    }, { intentKey: 'implement' });
    expect(saved.success).toBe(true);
    expect(saved.path).toContain(`${path.sep}contexts${path.sep}implement${path.sep}C010-bucket-test.md`);
  });

  it('knowledgeEntryWikiPath uses relativePath when set', async () => {
    const nested = path.join(wikiRoot, 'knowledge', 'contexts', 'topic', 'C002-x.md');
    fs.mkdirSync(path.dirname(nested), { recursive: true });
    fs.writeFileSync(
      nested,
      `---
id: "C002"
slug: "x"
request: "q"
type: "context"
tags: []
source:
  session_id: "s1"
  exploration_id: "e1"
---
`,
      'utf-8',
    );
    const entry = await repo.findById('C002');
    expect(knowledgeEntryWikiPath(entry!)).toBe(
      'wiki/knowledge/contexts/topic/C002-x.md',
    );
  });
});

function nextContextId(wikiRoot: string): string {
  return allocateId('context', collectKnowledgeIds(wikiRoot));
}
