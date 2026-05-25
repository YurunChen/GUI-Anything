import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { collectLintIssues } from './knowledge-lint-core';

describe('collectLintIssues', () => {
  let wikiRoot: string;

  beforeEach(() => {
    wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-lint-'));
    const contexts = path.join(wikiRoot, 'knowledge', 'contexts', 'implement');
    fs.mkdirSync(contexts, { recursive: true });
    fs.writeFileSync(
      path.join(contexts, 'C001-a.md'),
      `---
id: "C001"
slug: "a"
request: "same task"
type: "context"
tags: []
source:
  session_id: "s1"
  exploration_id: "e1"
---
body
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(contexts, 'C002-b.md'),
      `---
id: "C002"
slug: "b"
request: "same task"
type: "context"
tags: []
source:
  session_id: "s1"
  exploration_id: "e2"
---
body
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(wikiRoot, 'knowledge', 'index.md'),
      '# index\n\nC001 C002\n',
      'utf-8',
    );
  });

  afterEach(() => {
    fs.rmSync(wikiRoot, { recursive: true, force: true });
  });

  it('warns on duplicate request', () => {
    const result = collectLintIssues(wikiRoot);
    expect(result.warnCount).toBeGreaterThanOrEqual(1);
    expect(result.issues.some((i) => i.message.includes('duplicate request'))).toBe(true);
  });
});
