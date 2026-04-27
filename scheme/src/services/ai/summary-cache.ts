import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SessionId, ExplorationId, SummaryItem, WikiPersistMeta } from '../../data/protocol/observer-protocol';

export interface CachedSummary {
  text: string;
  source: 'ai' | 'fallback';
  status: 'ready' | 'failed';
  persistMeta: WikiPersistMeta | null;
  createdAt: number;
  /** Reason for fallback or additional provenance info */
  reason?: string;
}

export interface SummaryCacheData {
  sessionId: SessionId;
  cachedAt: number;
  jsonlMtime: number;
  summaries: Record<ExplorationId, CachedSummary>;
}

/** Re-export from protocol for consistency */
export type CacheLoadStatus = import('../../data/protocol/observer-protocol').CacheLoadStatus;

export interface CacheLoadResult {
  status: CacheLoadStatus;
  data: SummaryCacheData | null;
  /** Human-readable description of the cache state */
  reason: string;
}

// Use wiki/runtime/summaries as the cache directory (separate from evidence)
function getWikiRoot(): string {
  const projectRoot = process.env.FLOW_PROJECT_DIR || process.env.FLOW_ROOT_DIR;
  if (projectRoot) {
    return path.join(projectRoot, 'wiki');
  }
  const cwdWiki = path.join(process.cwd(), 'wiki');
  if (fs.existsSync(cwdWiki)) return cwdWiki;
  const parentWiki = path.join(process.cwd(), '..', 'wiki');
  if (fs.existsSync(parentWiki)) return parentWiki;
  return cwdWiki;
}

function getCacheDir(): string {
  return path.join(getWikiRoot(), 'runtime');
}

function getCacheFilePath(sessionId: string): string {
  return path.join(getCacheDir(), `${sessionId}-summaries.json`);
}

function ensureCacheDir(): void {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load cached summaries for a session.
 * Returns null if cache doesn't exist or is expired (jsonlMtime < current JSONL mtime).
 */
export function loadSummaries(
  sessionId: SessionId,
  jsonlPath: string,
): SummaryCacheData | null {
  const result = loadSummariesWithStatus(sessionId, jsonlPath);
  return result.data;
}

/**
 * Load cached summaries with detailed status for provenance tracking.
 */
export function loadSummariesWithStatus(
  sessionId: SessionId,
  jsonlPath: string,
): CacheLoadResult {
  const cachePath = getCacheFilePath(sessionId);

  if (!fs.existsSync(cachePath)) {
    return { status: 'miss', data: null, reason: 'cache_file_not_found' };
  }

  // Check if JSONL file exists and get its current mtime
  if (!fs.existsSync(jsonlPath)) {
    return { status: 'miss', data: null, reason: 'jsonl_source_missing' };
  }

  const currentJsonlMtime = fs.statSync(jsonlPath).mtimeMs;

  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const cache: SummaryCacheData = JSON.parse(content);

    // Validate cache structure
    if (!cache.sessionId || cache.sessionId !== sessionId) {
      return { status: 'corrupted', data: null, reason: 'session_id_mismatch' };
    }

    // Check if cache is expired
    if (cache.jsonlMtime < currentJsonlMtime) {
      // Cache is stale, clear it
      clearCache(sessionId);
      return { status: 'expired', data: null, reason: `jsonl_modified_since_cache` };
    }

    return {
      status: 'hit',
      data: cache,
      reason: `valid_cache_${Object.keys(cache.summaries).length}_summaries`,
    };
  } catch {
    // Invalid cache file, remove it
    try {
      fs.unlinkSync(cachePath);
    } catch {
      // Ignore unlink errors
    }
    return { status: 'corrupted', data: null, reason: 'parse_error' };
  }
}

/**
 * Save a summary to cache.
 */
export function saveSummary(
  sessionId: SessionId,
  jsonlPath: string,
  explorationId: ExplorationId,
  summary: SummaryItem,
): void {
  ensureCacheDir();

  const cachePath = getCacheFilePath(sessionId);
  let cache: SummaryCacheData;

  // Get current JSONL mtime
  const jsonlMtime = fs.existsSync(jsonlPath) ? fs.statSync(jsonlPath).mtimeMs : Date.now();

  // Try to load existing cache
  if (fs.existsSync(cachePath)) {
    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      cache = JSON.parse(content);
      // Update mtime if JSONL has been modified
      cache.jsonlMtime = jsonlMtime;
    } catch {
      // Start fresh if existing cache is corrupted
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

  // Update the specific summary
  cache.summaries[explorationId] = {
    text: summary.text,
    source: summary.source === 'ai' ? 'ai' : 'fallback',
    status: summary.status === 'failed' ? 'failed' : 'ready',
    persistMeta: summary.persistMeta,
    createdAt: Date.now(),
    reason: summary.reason,
  };

  cache.cachedAt = Date.now();

  // Write back to file
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Save multiple summaries to cache at once.
 */
export function saveSummaries(
  sessionId: SessionId,
  jsonlPath: string,
  summaries: Record<ExplorationId, SummaryItem>,
): void {
  ensureCacheDir();

  const cachePath = getCacheFilePath(sessionId);
  const jsonlMtime = fs.existsSync(jsonlPath) ? fs.statSync(jsonlPath).mtimeMs : Date.now();

  const cache: SummaryCacheData = {
    sessionId,
    cachedAt: Date.now(),
    jsonlMtime,
    summaries: {},
  };

  for (const [explorationId, summary] of Object.entries(summaries)) {
    cache.summaries[explorationId] = {
      text: summary.text,
      source: summary.source === 'ai' ? 'ai' : 'fallback',
      status: summary.status === 'failed' ? 'failed' : 'ready',
      persistMeta: summary.persistMeta,
      createdAt: Date.now(),
      reason: summary.reason,
    };
  }

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Convert cached summaries to SummaryItem format.
 * All cached items are marked with source='cache' plus the original source as reason.
 */
export function cachedToSummaryItems(
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
      // Provenance: cache hit + original source (ai/fallback) + reason if exists
      reason: cached.reason || `from_${cached.source}`,
    };
  }

  return items;
}

/**
 * Clear cache for a specific session.
 */
export function clearCache(sessionId: SessionId): void {
  const cachePath = getCacheFilePath(sessionId);
  if (fs.existsSync(cachePath)) {
    try {
      fs.unlinkSync(cachePath);
    } catch {
      // Ignore unlink errors
    }
  }
}

/**
 * Clear all caches.
 */
export function clearAllCaches(): void {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) {
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(dir, file));
    } catch {
      // Ignore unlink errors
    }
  }
}

/**
 * Get cache statistics for a session.
 */
export function getCacheStats(sessionId: SessionId): {
  exists: boolean;
  summaryCount: number;
  cachedAt: number | null;
} {
  const cachePath = getCacheFilePath(sessionId);

  if (!fs.existsSync(cachePath)) {
    return { exists: false, summaryCount: 0, cachedAt: null };
  }

  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const cache: SummaryCacheData = JSON.parse(content);
    return {
      exists: true,
      summaryCount: Object.keys(cache.summaries).length,
      cachedAt: cache.cachedAt,
    };
  } catch {
    return { exists: false, summaryCount: 0, cachedAt: null };
  }
}
