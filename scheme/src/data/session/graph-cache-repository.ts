import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FlowGraphSnapshot, SessionId } from '../protocol/observer-protocol';
import { resolveWikiRoot } from '../env';

export interface GraphCacheRecord {
  sessionId: SessionId;
  jsonlMtime: number;
  savedAt: number;
  fingerprint: string;
  snapshot: FlowGraphSnapshot;
}

export interface GraphCacheRepository {
  load(sessionId: SessionId): GraphCacheRecord | null;
  save(record: GraphCacheRecord): void;
  clear(sessionId: SessionId): void;
}

function getRuntimeDir(): string {
  return path.join(resolveWikiRoot(), 'runtime');
}

function getGraphCachePath(sessionId: SessionId): string {
  return path.join(getRuntimeDir(), `${sessionId}-graph.json`);
}

function ensureRuntimeDir(): void {
  const dir = getRuntimeDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class FileGraphCacheRepository implements GraphCacheRepository {
  load(sessionId: SessionId): GraphCacheRecord | null {
    const cachePath = getGraphCachePath(sessionId);
    if (!fs.existsSync(cachePath)) return null;
    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(content) as GraphCacheRecord;
    } catch {
      try {
        fs.unlinkSync(cachePath);
      } catch {
        // Ignore cleanup failures.
      }
      return null;
    }
  }

  save(record: GraphCacheRecord): void {
    ensureRuntimeDir();
    const cachePath = getGraphCachePath(record.sessionId);
    fs.writeFileSync(cachePath, JSON.stringify(record, null, 2), 'utf-8');
  }

  clear(sessionId: SessionId): void {
    const cachePath = getGraphCachePath(sessionId);
    if (!fs.existsSync(cachePath)) return;
    try {
      fs.unlinkSync(cachePath);
    } catch {
      // Ignore cleanup failures.
    }
  }
}
