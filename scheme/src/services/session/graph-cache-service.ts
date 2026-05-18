import type {
  Exploration,
  FlowGraphSnapshot,
  FlowchartHint,
  SessionId,
} from '../../data/protocol/observer-protocol';
import {
  FileGraphCacheRepository,
  type GraphCacheRepository,
} from '../../data/session/graph-cache-repository';
import {
  buildGraphFingerprint,
  type GraphFingerprintInput,
} from '../../utils/graph-fingerprint';

export type GraphCacheLoadStatus = 'hit' | 'miss' | 'stale' | 'corrupted';

export interface GraphCacheLoadResult {
  status: GraphCacheLoadStatus;
  reason: string;
  snapshot: FlowGraphSnapshot | null;
}

export type { GraphFingerprintInput } from '../../utils/graph-fingerprint';

export interface GraphCacheService {
  loadGraphSnapshotWithStatus(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
  }): GraphCacheLoadResult;
  saveGraphSnapshot(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
  }): void;
  clearGraphCache(sessionId: SessionId): void;
}

export class DefaultGraphCacheService implements GraphCacheService {
  constructor(private readonly repository: GraphCacheRepository = new FileGraphCacheRepository()) {}

  loadGraphSnapshotWithStatus(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
  }): GraphCacheLoadResult {
    const cache = this.repository.load(input.sessionId);
    if (!cache) {
      return { status: 'miss', reason: 'cache_file_not_found', snapshot: null };
    }
    if (!cache.sessionId || cache.sessionId !== input.sessionId) {
      return { status: 'corrupted', reason: 'session_id_mismatch', snapshot: null };
    }
    if (cache.jsonlMtime !== input.jsonlMtime) {
      return { status: 'stale', reason: 'jsonl_mtime_mismatch', snapshot: null };
    }
    if (cache.fingerprint !== input.fingerprint) {
      return { status: 'stale', reason: 'input_fingerprint_mismatch', snapshot: null };
    }
    return {
      status: 'hit',
      reason: 'cache_hit',
      snapshot: cache.snapshot,
    };
  }

  saveGraphSnapshot(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
  }): void {
    this.repository.save({
      sessionId: input.sessionId,
      jsonlMtime: input.jsonlMtime,
      fingerprint: input.fingerprint,
      snapshot: input.snapshot,
      savedAt: Date.now(),
    });
  }

  clearGraphCache(sessionId: SessionId): void {
    this.repository.clear(sessionId);
  }
}

export function buildGraphInputFingerprint(input: GraphFingerprintInput): string {
  return buildGraphFingerprint(input);
}
