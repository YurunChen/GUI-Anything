import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { KnowledgeRepository } from '../../../data/wiki/knowledge-repository';
import {
  sanitizeKnowledgeRelativePath,
  validateManifestFilesWritten,
  resolveAgentWriteProof,
} from './validate-agent-write';

describe('sanitizeKnowledgeRelativePath', () => {
  let wikiRoot: string;

  beforeEach(() => {
    wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-val-'));
    fs.mkdirSync(path.join(wikiRoot, 'knowledge', 'contexts'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(wikiRoot, { recursive: true, force: true });
  });

  it('accepts knowledge/contexts paths', () => {
    const rel = sanitizeKnowledgeRelativePath(
      'knowledge/contexts/C001-test.md',
      wikiRoot,
    );
    expect(rel).toBe('knowledge/contexts/C001-test.md');
  });

  it('rejects parent traversal', () => {
    expect(sanitizeKnowledgeRelativePath('../secrets.md', wikiRoot)).toBeNull();
    expect(sanitizeKnowledgeRelativePath('knowledge/../notes/x.md', wikiRoot)).toBeNull();
  });

  it('accepts knowledge/summaries paths', () => {
    expect(
      sanitizeKnowledgeRelativePath('knowledge/summaries/S001-test.md', wikiRoot),
    ).toBe('knowledge/summaries/S001-test.md');
  });

  it('rejects legacy errors/ paths', () => {
    expect(
      sanitizeKnowledgeRelativePath('knowledge/errors/E001-test.md', wikiRoot),
    ).toBeNull();
  });

  it('accepts knowledge/entities paths', () => {
    expect(
      sanitizeKnowledgeRelativePath('knowledge/entities/N001-paper.md', wikiRoot),
    ).toBe('knowledge/entities/N001-paper.md');
  });

  it('accepts nested contexts paths', () => {
    expect(
      sanitizeKnowledgeRelativePath('knowledge/contexts/topic/C001-hypothesis.md', wikiRoot),
    ).toBe('knowledge/contexts/topic/C001-hypothesis.md');
    expect(
      sanitizeKnowledgeRelativePath('knowledge/contexts/implement/C001-hypothesis.md', wikiRoot),
    ).toBe('knowledge/contexts/implement/C001-hypothesis.md');
  });

  it('rejects audit and outputs paths', () => {
    expect(sanitizeKnowledgeRelativePath('knowledge/audit/A001.md', wikiRoot)).toBeNull();
    expect(sanitizeKnowledgeRelativePath('knowledge/log/2026-05-25.md', wikiRoot)).toBeNull();
    expect(
      sanitizeKnowledgeRelativePath('knowledge/outputs/progress/index.html', wikiRoot),
    ).toBeNull();
  });
});

describe('validateManifestFilesWritten', () => {
  let wikiRoot: string;

  beforeEach(() => {
    wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-val-'));
    const file = path.join(wikiRoot, 'knowledge', 'contexts', 'C001-test.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '# test', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(wikiRoot, { recursive: true, force: true });
  });

  it('returns ok when files exist', () => {
    const r = validateManifestFilesWritten(
      {
        action: 'update',
        target_id: 'C001',
        files_written: ['knowledge/contexts/C001-test.md'],
        reason: 'ok',
      },
      wikiRoot,
    );
    expect(r.ok).toBe(true);
    expect(r.paths).toHaveLength(1);
  });

  it('returns false when file missing', () => {
    const r = validateManifestFilesWritten(
      {
        action: 'create',
        files_written: ['knowledge/contexts/C999-missing.md'],
        reason: 'bad',
      },
      wikiRoot,
    );
    expect(r.ok).toBe(false);
  });
});

describe('resolveAgentWriteProof', () => {
  let wikiRoot: string;
  let repo: KnowledgeRepository;

  beforeEach(() => {
    wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-val-'));
    repo = new KnowledgeRepository(wikiRoot);
    const file = path.join(wikiRoot, 'knowledge', 'contexts', 'C001-test.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---
id: "C001"
slug: "test"
request: "q"
created: "2026-01-01T00:00:00.000Z"
version: 1
type: "context"
category: "contexts"
tags: []
related: []
aliases: []
source:
  session_id: "s1"
  exploration_id: "e1"
extraction_confidence: 0.8
status: "draft"
---
body
`, 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(wikiRoot, { recursive: true, force: true });
  });

  it('proves update when file exists and target found', async () => {
    const proof = await resolveAgentWriteProof(
      {
        action: 'update',
        target_id: 'C001',
        files_written: ['knowledge/contexts/C001-test.md'],
        reason: 'ok',
      },
      wikiRoot,
      repo,
      's1',
      'e1',
      null,
    );
    expect(proof.ok).toBe(true);
    expect(proof.targetId).toBe('C001');
  });

  it('fails create when no files and no source', async () => {
    const proof = await resolveAgentWriteProof(
      {
        action: 'create',
        files_written: ['knowledge/contexts/C002-new.md'],
        reason: 'bad',
      },
      wikiRoot,
      repo,
      's2',
      'e2',
      null,
    );
    expect(proof.ok).toBe(false);
  });
});
