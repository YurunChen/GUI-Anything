import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadSummaries,
  saveSummary,
  saveSummaries,
  cachedToSummaryItems,
  clearCache,
  getCacheStats,
} from './summary-cache';
import type { SummaryItem } from '../../data/protocol/observer-protocol';

describe('summary-cache', () => {
  let tempDir: string;
  let wikiDir: string;
  let jsonlPath: string;
  let originalFlowProjectDir: string | undefined;

  beforeEach(() => {
    // Create a temp directory with wiki/runtime structure
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-cache-test-'));
    wikiDir = path.join(tempDir, 'wiki');
    fs.mkdirSync(path.join(wikiDir, 'runtime'), { recursive: true });
    jsonlPath = path.join(tempDir, 'test-session.jsonl');
    fs.writeFileSync(jsonlPath, 'test content');

    // Set FLOW_PROJECT_DIR to temp directory so wiki root is found
    originalFlowProjectDir = process.env.FLOW_PROJECT_DIR;
    process.env.FLOW_PROJECT_DIR = tempDir;
  });

  afterEach(() => {
    // Cleanup
    if (originalFlowProjectDir !== undefined) {
      process.env.FLOW_PROJECT_DIR = originalFlowProjectDir;
    } else {
      delete process.env.FLOW_PROJECT_DIR;
    }

    // Remove temp directory
    try {
      fs.rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return null when no cache exists', () => {
    const result = loadSummaries('non-existent-session', jsonlPath);
    expect(result).toBeNull();
  });

  it('should save and load a summary', () => {
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

    saveSummary(sessionId, jsonlPath, explorationId, summary);

    const cache = loadSummaries(sessionId, jsonlPath);
    expect(cache).not.toBeNull();
    expect(cache!.sessionId).toBe(sessionId);
    expect(cache!.summaries[explorationId]).not.toBeNull();
    expect(cache!.summaries[explorationId].text).toBe('Test summary');
  });

  it('should return null when cache is expired', () => {
    const sessionId = 'test-session';
    const explorationId = 'exp_1';
    const summary: SummaryItem = {
      id: `${sessionId}:${explorationId}`,
      sessionId,
      explorationId,
      text: 'Test summary',
      source: 'ai',
      status: 'ready',
      persistMeta: null,
    };

    // Save summary
    saveSummary(sessionId, jsonlPath, explorationId, summary);

    // Modify JSONL file to make cache stale
    fs.utimesSync(jsonlPath, Date.now() / 1000 + 10, Date.now() / 1000 + 10);

    // Load should return null (cache expired)
    const cache = loadSummaries(sessionId, jsonlPath);
    expect(cache).toBeNull();
  });

  it('should convert cached summaries to SummaryItem format', () => {
    const sessionId = 'test-session';
    const summaries: Record<string, SummaryItem> = {
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
        persistMeta: { should_persist: true, type: 'decision' },
      },
    };

    saveSummaries(sessionId, jsonlPath, summaries);

    const cache = loadSummaries(sessionId, jsonlPath);
    expect(cache).not.toBeNull();

    const items = cachedToSummaryItems(sessionId, cache!);
    expect(Object.keys(items).length).toBe(2);
    expect(items[`${sessionId}:exp_1`].text).toBe('Summary 1');
    expect(items[`${sessionId}:exp_2`].text).toBe('Summary 2');
  });

  it('should clear cache', () => {
    const sessionId = 'test-session';
    const summary: SummaryItem = {
      id: `${sessionId}:exp_1`,
      sessionId,
      explorationId: 'exp_1',
      text: 'Test summary',
      source: 'ai',
      status: 'ready',
      persistMeta: null,
    };

    saveSummary(sessionId, jsonlPath, 'exp_1', summary);
    expect(loadSummaries(sessionId, jsonlPath)).not.toBeNull();

    clearCache(sessionId);
    expect(loadSummaries(sessionId, jsonlPath)).toBeNull();
  });

  it('should return cache stats', () => {
    const sessionId = 'test-session';
    const summary: SummaryItem = {
      id: `${sessionId}:exp_1`,
      sessionId,
      explorationId: 'exp_1',
      text: 'Test summary',
      source: 'ai',
      status: 'ready',
      persistMeta: null,
    };

    // No cache yet
    let stats = getCacheStats(sessionId);
    expect(stats.exists).toBe(false);
    expect(stats.summaryCount).toBe(0);

    // Save a summary
    saveSummary(sessionId, jsonlPath, 'exp_1', summary);

    stats = getCacheStats(sessionId);
    expect(stats.exists).toBe(true);
    expect(stats.summaryCount).toBe(1);
    expect(stats.cachedAt).not.toBeNull();
  });

  it('should save cache to wiki/runtime directory', () => {
    const sessionId = 'test-session-runtime';
    const summary: SummaryItem = {
      id: `${sessionId}:exp_1`,
      sessionId,
      explorationId: 'exp_1',
      text: 'Test summary in runtime',
      source: 'ai',
      status: 'ready',
      persistMeta: null,
    };

    saveSummary(sessionId, jsonlPath, 'exp_1', summary);

    // Verify cache file exists in wiki/runtime
    const cachePath = path.join(tempDir, 'wiki', 'runtime', `${sessionId}-summaries.json`);
    expect(fs.existsSync(cachePath)).toBe(true);

    // Verify content
    const content = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    expect(content.sessionId).toBe(sessionId);
    expect(content.summaries.exp_1.text).toBe('Test summary in runtime');
  });
});
