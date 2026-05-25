import type {
  GraphCacheRecord,
  SessionFlowRecord,
  SessionId,
} from '../protocol/observer-protocol';
import { SESSION_FLOW_RECORD_VERSION } from '../protocol/observer-protocol';
import {
  ensureDir,
  sessionGraphCachePath,
  sessionRecordPath,
  wikiSessionsDir,
} from '../wiki/wiki-data-layout';
import { deleteJsonFile, readJsonFile, writeJsonFile } from './json-io';

export interface SessionFlowRepository {
  load(sessionId: SessionId): SessionFlowRecord | null;
  save(record: SessionFlowRecord): void;
  clear(sessionId: SessionId): void;
}

function ensureSessionsDir(): void {
  ensureDir(wikiSessionsDir());
}

function migrateLegacyGraphCache(legacy: GraphCacheRecord): SessionFlowRecord {
  return {
    version: SESSION_FLOW_RECORD_VERSION,
    sessionId: legacy.sessionId,
    jsonlMtime: legacy.jsonlMtime,
    fingerprint: legacy.fingerprint,
    revision: 1,
    updatedAt: legacy.savedAt || Date.now(),
    flowGraph: legacy.snapshot,
    flowchartHints: {},
  };
}

function normalizeLoadedRecord(raw: SessionFlowRecord | GraphCacheRecord): SessionFlowRecord | null {
  if ('flowGraph' in raw && raw.flowGraph) {
    const record = raw as SessionFlowRecord;
    if (!record.version) {
      record.version = SESSION_FLOW_RECORD_VERSION;
    }
    if (!record.flowchartHints) {
      record.flowchartHints = {};
    }
    return record;
  }
  if ('snapshot' in raw && (raw as GraphCacheRecord).snapshot) {
    return migrateLegacyGraphCache(raw as GraphCacheRecord);
  }
  return null;
}

export class FileSessionFlowRepository implements SessionFlowRepository {
  load(sessionId: SessionId): SessionFlowRecord | null {
    const primary = readJsonFile<SessionFlowRecord | GraphCacheRecord>(sessionRecordPath(sessionId));
    if (primary && primary !== (Symbol.for('corrupted') as unknown as SessionFlowRecord)) {
      const normalized = normalizeLoadedRecord(primary);
      if (normalized) return normalized;
    }
    if (primary === (Symbol.for('corrupted') as unknown as SessionFlowRecord)) {
      deleteJsonFile(sessionRecordPath(sessionId));
    }

    const legacyPath = sessionGraphCachePath(sessionId);
    const legacy = readJsonFile<GraphCacheRecord>(legacyPath);
    if (!legacy || legacy === (Symbol.for('corrupted') as unknown as GraphCacheRecord)) {
      if (legacy === (Symbol.for('corrupted') as unknown as GraphCacheRecord)) {
        deleteJsonFile(legacyPath);
      }
      return null;
    }
    const migrated = migrateLegacyGraphCache(legacy);
    if (migrated.sessionId !== sessionId) {
      return null;
    }
    this.save(migrated);
    deleteJsonFile(legacyPath);
    return migrated;
  }

  save(record: SessionFlowRecord): void {
    ensureSessionsDir();
    writeJsonFile(sessionRecordPath(record.sessionId), record);
  }

  clear(sessionId: SessionId): void {
    deleteJsonFile(sessionRecordPath(sessionId));
    deleteJsonFile(sessionGraphCachePath(sessionId));
  }
}
