/**
 * ABOUTME: Incremental UTF-8 read + stat fingerprint for live JSONL observer polling.
 */

import * as fs from 'node:fs';

export type SessionJsonlCache = {
  path: string;
  content: string;
  /** Byte length on disk; read offset for appends (must match fs.stat.size after reads). */
  fileSize: number;
  mtimeMs: number;
};

export function createEmptySessionJsonlCache(): SessionJsonlCache {
  return { path: '', content: '', fileSize: 0, mtimeMs: 0 };
}

/**
 * Refresh cache from disk. Returns whether `content` was mutated (caller should re-parse).
 * Uses size+mtime to skip work when the file is unchanged.
 */
export function refreshSessionJsonlCache(absPath: string, cache: SessionJsonlCache): boolean {
  let st: fs.Stats;
  try {
    st = fs.statSync(absPath);
  } catch {
    return false;
  }

  if (cache.path !== absPath) {
    cache.content = fs.readFileSync(absPath, 'utf-8');
    cache.path = absPath;
    cache.fileSize = st.size;
    cache.mtimeMs = st.mtimeMs;
    return true;
  }

  if (st.size === cache.fileSize && st.mtimeMs === cache.mtimeMs) {
    return false;
  }

  if (st.size === cache.fileSize && st.mtimeMs !== cache.mtimeMs) {
    const next = fs.readFileSync(absPath, 'utf-8');
    if (next === cache.content) {
      cache.mtimeMs = st.mtimeMs;
      return false;
    }
    cache.content = next;
    cache.mtimeMs = st.mtimeMs;
    return true;
  }

  if (st.size < cache.fileSize || cache.fileSize === 0) {
    cache.content = fs.readFileSync(absPath, 'utf-8');
    cache.fileSize = st.size;
    cache.mtimeMs = st.mtimeMs;
    return true;
  }

  const fd = fs.openSync(absPath, 'r');
  try {
    const byteLen = st.size - cache.fileSize;
    const buf = Buffer.alloc(byteLen);
    fs.readSync(fd, buf, 0, byteLen, cache.fileSize);
    cache.content += buf.toString('utf-8');
    cache.fileSize = st.size;
    cache.mtimeMs = st.mtimeMs;
  } finally {
    fs.closeSync(fd);
  }
  return true;
}
