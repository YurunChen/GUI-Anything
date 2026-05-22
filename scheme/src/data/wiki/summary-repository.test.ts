import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  FileSummaryRepository,
  cachedToSummaryItems,
} from './summary-repository';
import type { SummaryItem } from '../protocol/observer-protocol';

describe('FileSummaryRepository', () => {
  let tempDir = '';
  let wikiRoot = '';
  let jsonlPath = '';
  let repo: FileSummaryRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-repo-test-'));
    wikiRoot = path.join(tempDir, 'wiki');
    fs.mkdirSync(path.join(wikiRoot, 'runtime'), { recursive: true });
    jsonlPath = path.join(tempDir, 'test-session.jsonl');
    fs.writeFileSync(jsonlPath, 'test content');
    repo = new FileSummaryRepository({ wikiRoot });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns null when no cache exists', () => {
    expect(repo.load('non-existent-session', jsonlPath)).toBeNull();
  });

  it('saveOne and load round-trip', () => {
    const sessionId = 'test-session';
    const explorationId = 'exp_1';
    const summary: SummaryItem = {
      id: `${sessionId}:${explorationId}`,
      sessionId,
      explorationId,
      text: 'Test summary',
      source: 'ai',
      status: 'ready',
      persistMeta: { should_persist: true, type: 'context', confidence: 0.9 },
    };

    repo.saveOne(sessionId, jsonlPath, explorationId, summary);
    const cache = repo.load(sessionId, jsonlPath);
    expect(cache?.summaries[explorationId].text).toBe('Test summary');
  });

  it('expires when jsonl mtime advances', () => {
    const sessionId = 'test-session';
    repo.saveOne(sessionId, jsonlPath, 'exp_1', {
      id: `${sessionId}:exp_1`,
      sessionId,
      explorationId: 'exp_1',
      text: 'Test summary',
      source: 'ai',
      status: 'ready',
      persistMeta: null,
    });

    fs.utimesSync(jsonlPath, Date.now() / 1000 + 10, Date.now() / 1000 + 10);
    const expired = repo.loadWithStatus(sessionId, jsonlPath);
    expect(expired.status).toBe('expired');
    expect(expired.data).toBeNull();
    expect(repo.load(sessionId, jsonlPath)).toBeNull();
  });

  it('toSummaryItems maps cache entries', () => {
    const sessionId = 'test-session';
    repo.saveMany(sessionId, jsonlPath, {
      exp_1: {
        id: `${sessionId}:exp_1`,
        sessionId,
        explorationId: 'exp_1',
        text: 'Summary 1',
        source: 'ai',
        status: 'ready',
        persistMeta: null,
      },
      exp_2: {
        id: `${sessionId}:exp_2`,
        sessionId,
        explorationId: 'exp_2',
        text: 'Summary 2',
        source: 'ai',
        status: 'ready',
        persistMeta: { should_persist: true, type: 'decision', confidence: 0.9 },
      },
    });

    const cache = repo.load(sessionId, jsonlPath)!;
    const items = cachedToSummaryItems(sessionId, cache);
    expect(Object.keys(items).length).toBe(2);
    expect(items[`${sessionId}:exp_1`].source).toBe('cache');
  });

  it('clear removes cache file', () => {
    const sessionId = 'test-session';
    repo.saveOne(sessionId, jsonlPath, 'exp_1', {
      id: `${sessionId}:exp_1`,
      sessionId,
      explorationId: 'exp_1',
      text: 'x',
      source: 'ai',
      status: 'ready',
      persistMeta: null,
    });
    repo.clear(sessionId);
    expect(repo.load(sessionId, jsonlPath)).toBeNull();
  });

  it('writes under wiki/runtime', () => {
    const sessionId = 'runtime-session';
    repo.saveOne(sessionId, jsonlPath, 'exp_1', {
      id: `${sessionId}:exp_1`,
      sessionId,
      explorationId: 'exp_1',
      text: 'runtime',
      source: 'ai',
      status: 'ready',
      persistMeta: null,
    });
    const cachePath = path.join(wikiRoot, 'runtime', `${sessionId}-summaries.json`);
    expect(fs.existsSync(cachePath)).toBe(true);
  });
});
