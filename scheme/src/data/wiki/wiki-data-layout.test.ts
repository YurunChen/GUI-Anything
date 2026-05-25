import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ensureKnowledgeMetaLayout, purgeLegacyKnowledgeLayout, contextIntentBucketDir } from './wiki-data-layout';

describe('purgeLegacyKnowledgeLayout', () => {
  let wikiRoot: string;

  beforeEach(() => {
    wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-purge-'));
    const k = path.join(wikiRoot, 'knowledge');
    fs.mkdirSync(path.join(k, 'errors'), { recursive: true });
    fs.writeFileSync(path.join(k, 'errors', 'E001-old.md'), '# old', 'utf-8');
    fs.mkdirSync(path.join(k, 'contexts'), { recursive: true });
    fs.writeFileSync(path.join(k, 'contexts', 'D002-adr.md'), '# adr', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(wikiRoot, { recursive: true, force: true });
  });

  it('removes legacy dirs and E/S/D-prefixed files', () => {
    purgeLegacyKnowledgeLayout(wikiRoot);
    expect(fs.existsSync(path.join(wikiRoot, 'knowledge', 'errors'))).toBe(false);
    expect(fs.existsSync(path.join(wikiRoot, 'knowledge', 'contexts', 'D002-adr.md'))).toBe(false);
  });

  it('runs on ensureKnowledgeMetaLayout', () => {
    ensureKnowledgeMetaLayout(wikiRoot);
    expect(fs.existsSync(path.join(wikiRoot, 'knowledge', 'errors'))).toBe(false);
    expect(fs.existsSync(path.join(wikiRoot, 'knowledge', 'contexts'))).toBe(true);
    expect(fs.existsSync(contextIntentBucketDir('implement', wikiRoot))).toBe(true);
  });
});
