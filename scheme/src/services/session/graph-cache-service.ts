import type {
  FlowGraphSnapshot,
  SessionFlowRecord,
  SessionId,
} from '../../data/protocol/observer-protocol';
import { FileSessionFlowRepository } from '../../data/session/session-flow-repository';
import type { SessionFlowRepository } from '../../data/session/session-flow-repository';
import {
  buildGraphFingerprint as buildGraphInputFingerprintImpl,
  type GraphFingerprintInput,
} from '../../utils/graph-fingerprint';

export type GraphCacheLoadStatus = 'hit' | 'miss' | 'stale' | 'corrupted';

export interface GraphCacheLoadResult {
  status: GraphCacheLoadStatus;
  reason: string;
  snapshot: FlowGraphSnapshot | null;
  flowchartHints: SessionFlowRecord['flowchartHints'] | null;
  revision: number | null;
}

export type { GraphFingerprintInput } from '../../utils/graph-fingerprint';

export interface GraphCacheService {
  loadGraphSnapshotWithStatus(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
  }): GraphCacheLoadResult;
  saveSessionFlow(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
    flowchartHints: SessionFlowRecord['flowchartHints'];
  }): void;
  /** @deprecated Use saveSessionFlow */
  saveGraphSnapshot(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
    flowchartHints?: SessionFlowRecord['flowchartHints'];
  }): void;
  clearGraphCache(sessionId: SessionId): void;
}

export class DefaultGraphCacheService implements GraphCacheService {
  constructor(private readonly repository: SessionFlowRepository = new FileSessionFlowRepository()) {}

  loadGraphSnapshotWithStatus(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
  }): GraphCacheLoadResult {
    const cache = this.repository.load(input.sessionId);
    if (!cache) {
      return {
        status: 'miss',
        reason: 'session_record_not_found',
        snapshot: null,
        flowchartHints: null,
        revision: null,
      };
    }
    if (!cache.sessionId || cache.sessionId !== input.sessionId) {
      return {
        status: 'corrupted',
        reason: 'session_id_mismatch',
        snapshot: null,
        flowchartHints: null,
        revision: null,
      };
    }
    if (cache.jsonlMtime !== input.jsonlMtime) {
      return {
        status: 'stale',
        reason: 'jsonl_mtime_mismatch',
        snapshot: null,
        flowchartHints: null,
        revision: null,
      };
    }
    if (cache.fingerprint !== input.fingerprint) {
      return {
        status: 'stale',
        reason: 'input_fingerprint_mismatch',
        snapshot: null,
        flowchartHints: null,
        revision: null,
      };
    }
    return {
      status: 'hit',
      reason: 'session_record_hit',
      snapshot: cache.flowGraph,
      flowchartHints: cache.flowchartHints ?? {},
      revision: cache.revision ?? 0,
    };
  }

  saveSessionFlow(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
    flowchartHints: SessionFlowRecord['flowchartHints'];
  }): void {
    const existing = this.repository.load(input.sessionId);
    const record: SessionFlowRecord = {
      version: 1,
      sessionId: input.sessionId,
      jsonlMtime: input.jsonlMtime,
      fingerprint: input.fingerprint,
      revision: (existing?.revision ?? 0) + 1,
      updatedAt: Date.now(),
      flowGraph: input.snapshot,
      flowchartHints: input.flowchartHints,
    };
    this.repository.save(record);
  }

  saveGraphSnapshot(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
    flowchartHints?: SessionFlowRecord['flowchartHints'];
  }): void {
    this.saveSessionFlow({
      sessionId: input.sessionId,
      jsonlMtime: input.jsonlMtime,
      fingerprint: input.fingerprint,
      snapshot: input.snapshot,
      flowchartHints: input.flowchartHints ?? {},
    });
  }

  clearGraphCache(sessionId: SessionId): void {
    this.repository.clear(sessionId);
  }
}

export function buildGraphInputFingerprint(input: GraphFingerprintInput): string {
  return buildGraphInputFingerprintImpl(input);
}
