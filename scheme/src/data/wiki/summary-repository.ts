/**
 * AI exploration summary cache — CRUD for wiki/sessions/{sessionId}-summaries.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  SessionId,
  ExplorationId,
  SummaryItem,
  CacheLoadStatus,
  FlowchartHint,
} from '../protocol/observer-protocol';
import type { WikiPersistMeta } from '../protocol/wiki-types';
import { resolveWikiRoot } from '../env';
import {
  ensureDir,
  sessionSummariesPath,
  wikiSessionsDir,
} from './wiki-data-layout';

export interface CachedSummary {
  text: string;
  source: 'ai' | 'fallback';
  status: 'ready' | 'failed';
  persistMeta: WikiPersistMeta | null;
  createdAt: number;
  reason?: string;
  flowchart?: FlowchartHint;
}

export interface SummaryCacheData {
  sessionId: SessionId;
  cachedAt: number;
  jsonlMtime: number;
  summaries: Record<ExplorationId, CachedSummary>;
}

export interface CacheLoadResult {
  status: CacheLoadStatus;
  data: SummaryCacheData | null;
  reason: string;
}

export type SummaryCacheExpiredPolicy = 'clear' | 'stale';

export interface SummaryRepository {
  load(sessionId: SessionId, jsonlPath: string): SummaryCacheData | null;
  loadWithStatus(
    sessionId: SessionId,
    jsonlPath: string,
    options?: { onExpired?: SummaryCacheExpiredPolicy },
  ): CacheLoadResult;
  saveOne(
    sessionId: SessionId,
    jsonlPath: string,
    explorationId: ExplorationId,
    summary: SummaryItem,
  ): void;
  saveMany(
    sessionId: SessionId,
    jsonlPath: string,
    summaries: Record<ExplorationId, SummaryItem>,
  ): void;
  toSummaryItems(
    sessionId: SessionId,
    cache: SummaryCacheData,
  ): Record<`${SessionId}:${ExplorationId}`, SummaryItem>;
  clear(sessionId: SessionId): void;
  clearAll(): void;
  getStats(sessionId: SessionId): {
    exists: boolean;
    summaryCount: number;
    cachedAt: number | null;
  };
}

export interface SummaryRepositoryOptions {
  wikiRoot?: string;
}

export class FileSummaryRepository implements SummaryRepository {
  private readonly wikiRoot: string;

  constructor(options: SummaryRepositoryOptions = {}) {
    this.wikiRoot = options.wikiRoot ?? resolveWikiRoot();
  }

  private cachePath(sessionId: SessionId): string {
    return sessionSummariesPath(sessionId, this.wikiRoot);
  }

  private ensureSessionsDir(): void {
    ensureDir(wikiSessionsDir(this.wikiRoot));
  }

  load(sessionId: SessionId, jsonlPath: string): SummaryCacheData | null {
    return this.loadWithStatus(sessionId, jsonlPath).data;
  }

  loadWithStatus(
    sessionId: SessionId,
    jsonlPath: string,
    options?: { onExpired?: SummaryCacheExpiredPolicy },
  ): CacheLoadResult {
    const cachePath = this.cachePath(sessionId);

    if (!fs.existsSync(cachePath)) {
      return { status: 'miss', data: null, reason: 'cache_file_not_found' };
    }

    if (!fs.existsSync(jsonlPath)) {
      return { status: 'miss', data: null, reason: 'jsonl_source_missing' };
    }

    const currentJsonlMtime = fs.statSync(jsonlPath).mtimeMs;

    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const cache: SummaryCacheData = JSON.parse(content);

      if (!cache.sessionId || cache.sessionId !== sessionId) {
        return { status: 'corrupted', data: null, reason: 'session_id_mismatch' };
      }

      if (cache.jsonlMtime < currentJsonlMtime) {
        if (options?.onExpired === 'stale') {
          return {
            status: 'stale',
            data: cache,
            reason: 'jsonl_modified_since_cache',
          };
        }
        this.clear(sessionId);
        return { status: 'expired', data: null, reason: 'jsonl_modified_since_cache' };
      }

      return {
        status: 'hit',
        data: cache,
        reason: `valid_cache_${Object.keys(cache.summaries).length}_summaries`,
      };
    } catch {
      try {
        fs.unlinkSync(cachePath);
      } catch {
        // ignore
      }
      return { status: 'corrupted', data: null, reason: 'parse_error' };
    }
  }

  saveOne(
    sessionId: SessionId,
    jsonlPath: string,
    explorationId: ExplorationId,
    summary: SummaryItem,
  ): void {
    this.ensureSessionsDir();

    const cachePath = this.cachePath(sessionId);
    const jsonlMtime = fs.existsSync(jsonlPath) ? fs.statSync(jsonlPath).mtimeMs : Date.now();

    let cache: SummaryCacheData;
    if (fs.existsSync(cachePath)) {
      try {
        cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as SummaryCacheData;
        cache.jsonlMtime = jsonlMtime;
      } catch {
        cache = {
          sessionId,
          cachedAt: Date.now(),
          jsonlMtime,
          summaries: {},
        };
      }
    } else {
      cache = {
        sessionId,
        cachedAt: Date.now(),
        jsonlMtime,
        summaries: {},
      };
    }

    cache.summaries[explorationId] = this.toCachedSummary(summary);
    cache.cachedAt = Date.now();
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  }

  saveMany(
    sessionId: SessionId,
    jsonlPath: string,
    summaries: Record<ExplorationId, SummaryItem>,
  ): void {
    this.ensureSessionsDir();

    const jsonlMtime = fs.existsSync(jsonlPath) ? fs.statSync(jsonlPath).mtimeMs : Date.now();
    const cache: SummaryCacheData = {
      sessionId,
      cachedAt: Date.now(),
      jsonlMtime,
      summaries: {},
    };

    for (const [explorationId, summary] of Object.entries(summaries)) {
      cache.summaries[explorationId] = this.toCachedSummary(summary);
    }

    fs.writeFileSync(this.cachePath(sessionId), JSON.stringify(cache, null, 2), 'utf-8');
  }

  toSummaryItems(
    sessionId: SessionId,
    cache: SummaryCacheData,
  ): Record<`${SessionId}:${ExplorationId}`, SummaryItem> {
    const items: Record<`${SessionId}:${ExplorationId}`, SummaryItem> = {};

    for (const [explorationId, cached] of Object.entries(cache.summaries)) {
      const id: `${SessionId}:${ExplorationId}` = `${sessionId}:${explorationId}`;
      items[id] = {
        id,
        sessionId,
        explorationId,
        text: cached.text,
        source: 'cache',
        status: cached.status,
        persistMeta: cached.persistMeta,
        flowchart: cached.flowchart,
        reason: cached.reason || `from_${cached.source}`,
      };
    }

    return items;
  }

  clear(sessionId: SessionId): void {
    const cachePath = this.cachePath(sessionId);
    if (fs.existsSync(cachePath)) {
      try {
        fs.unlinkSync(cachePath);
      } catch {
        // ignore
      }
    }
  }

  clearAll(): void {
    const dir = wikiSessionsDir(this.wikiRoot);
    if (!fs.existsSync(dir)) return;

    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch {
        // ignore
      }
    }
  }

  getStats(sessionId: SessionId): {
    exists: boolean;
    summaryCount: number;
    cachedAt: number | null;
  } {
    const cachePath = this.cachePath(sessionId);
    if (!fs.existsSync(cachePath)) {
      return { exists: false, summaryCount: 0, cachedAt: null };
    }

    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as SummaryCacheData;
      return {
        exists: true,
        summaryCount: Object.keys(cache.summaries).length,
        cachedAt: cache.cachedAt,
      };
    } catch {
      return { exists: false, summaryCount: 0, cachedAt: null };
    }
  }

  private toCachedSummary(summary: SummaryItem): CachedSummary {
    return {
      text: summary.text,
      source: summary.source === 'ai' ? 'ai' : 'fallback',
      status: summary.status === 'failed' ? 'failed' : 'ready',
      persistMeta: summary.persistMeta,
      createdAt: Date.now(),
      reason: summary.reason,
      flowchart: summary.flowchart,
    };
  }
}

const defaultSummaryRepository = new FileSummaryRepository();

export function loadSummaries(sessionId: SessionId, jsonlPath: string): SummaryCacheData | null {
  return defaultSummaryRepository.load(sessionId, jsonlPath);
}

export function loadSummariesWithStatus(sessionId: SessionId, jsonlPath: string): CacheLoadResult {
  return defaultSummaryRepository.loadWithStatus(sessionId, jsonlPath);
}

export function saveSummary(
  sessionId: SessionId,
  jsonlPath: string,
  explorationId: ExplorationId,
  summary: SummaryItem,
): void {
  defaultSummaryRepository.saveOne(sessionId, jsonlPath, explorationId, summary);
}

export function saveSummaries(
  sessionId: SessionId,
  jsonlPath: string,
  summaries: Record<ExplorationId, SummaryItem>,
): void {
  defaultSummaryRepository.saveMany(sessionId, jsonlPath, summaries);
}

export function cachedToSummaryItems(
  sessionId: SessionId,
  cache: SummaryCacheData,
): Record<`${SessionId}:${ExplorationId}`, SummaryItem> {
  return defaultSummaryRepository.toSummaryItems(sessionId, cache);
}

export function clearCache(sessionId: SessionId): void {
  defaultSummaryRepository.clear(sessionId);
}

export function clearAllCaches(): void {
  defaultSummaryRepository.clearAll();
}

export function getCacheStats(sessionId: SessionId) {
  return defaultSummaryRepository.getStats(sessionId);
}
