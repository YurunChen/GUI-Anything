import type {
  FlowGraphSnapshot,
  SessionFlowRecord,
  SessionId,
} from '../../data/protocol/observer-protocol';
import { SESSION_FLOW_RECORD_VERSION } from '../../data/protocol/observer-protocol';
import { FileSessionFlowRepository } from '../../data/session/session-flow-repository';
import type { SessionFlowRepository } from '../../data/session/session-flow-repository';
import { resolveWorkspaceRootForCache } from '../../data/session/workspace-root';
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
    workspaceRoot?: string;
    jsonlPath?: string;
  }): GraphCacheLoadResult;
  saveSessionFlow(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
    flowchartHints: SessionFlowRecord['flowchartHints'];
    workspaceRoot?: string;
    jsonlPath?: string;
  }): void;
  saveGraphSnapshot(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
    flowchartHints?: SessionFlowRecord['flowchartHints'];
    workspaceRoot?: string;
    jsonlPath?: string;
  }): void;
  clearGraphCache(sessionId: SessionId): void;
}

export class DefaultGraphCacheService implements GraphCacheService {
  constructor(private readonly repository: SessionFlowRepository = new FileSessionFlowRepository()) {}

  loadGraphSnapshotWithStatus(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    workspaceRoot?: string;
    jsonlPath?: string;
  }): GraphCacheLoadResult {
    const currentWorkspace = input.workspaceRoot ?? resolveWorkspaceRootForCache();
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
    if (!cache.workspaceRoot) {
      return {
        status: 'stale',
        reason: 'workspace_root_missing',
        snapshot: null,
        flowchartHints: null,
        revision: null,
      };
    }
    if (cache.workspaceRoot !== currentWorkspace) {
      return {
        status: 'corrupted',
        reason: 'workspace_mismatch',
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
    workspaceRoot?: string;
    jsonlPath?: string;
  }): void {
    const existing = this.repository.load(input.sessionId);
    const record: SessionFlowRecord = {
      version: SESSION_FLOW_RECORD_VERSION,
      sessionId: input.sessionId,
      jsonlMtime: input.jsonlMtime,
      fingerprint: input.fingerprint,
      revision: (existing?.revision ?? 0) + 1,
      updatedAt: Date.now(),
      flowGraph: input.snapshot,
      flowchartHints: input.flowchartHints,
      workspaceRoot: input.workspaceRoot ?? resolveWorkspaceRootForCache(),
    };
    this.repository.save(record, input.jsonlPath);
  }

  saveGraphSnapshot(input: {
    sessionId: SessionId;
    jsonlMtime: number;
    fingerprint: string;
    snapshot: FlowGraphSnapshot;
    flowchartHints?: SessionFlowRecord['flowchartHints'];
    workspaceRoot?: string;
    jsonlPath?: string;
  }): void {
    this.saveSessionFlow({
      sessionId: input.sessionId,
      jsonlMtime: input.jsonlMtime,
      fingerprint: input.fingerprint,
      snapshot: input.snapshot,
      flowchartHints: input.flowchartHints ?? {},
      workspaceRoot: input.workspaceRoot,
      jsonlPath: input.jsonlPath,
    });
  }

  clearGraphCache(sessionId: SessionId): void {
    this.repository.clear(sessionId);
  }
}

export function buildGraphInputFingerprint(input: GraphFingerprintInput): string {
  return buildGraphInputFingerprintImpl(input);
}
