import type {
  GraphCacheRecord,
  SessionFlowRecord,
  SessionId,
} from '../protocol/observer-protocol';
import { SESSION_FLOW_RECORD_VERSION } from '../protocol/observer-protocol';
import {
  defaultSessionBundleRepository,
  type SessionBundleRepository,
} from '../wiki/session-bundle-repository';

export interface SessionFlowRepository {
  load(sessionId: SessionId): SessionFlowRecord | null;
  save(record: SessionFlowRecord, jsonlPath?: string): void;
  clear(sessionId: SessionId): void;
}

function bundleToFlowRecord(sessionId: SessionId, bundle: NonNullable<ReturnType<SessionBundleRepository['load']>>): SessionFlowRecord {
  return {
    version: SESSION_FLOW_RECORD_VERSION,
    sessionId,
    jsonlMtime: bundle.meta.jsonlMtime,
    fingerprint: bundle.session.flow.fingerprint,
    revision: bundle.session.flow.revision,
    updatedAt: bundle.meta.updatedAt,
    flowGraph: bundle.session.flow.flowGraph,
    flowchartHints: bundle.session.flow.flowchartHints,
    workspaceRoot: bundle.meta.workspaceRoot,
  };
}

export class FileSessionFlowRepository implements SessionFlowRepository {
  constructor(private readonly bundleRepo: SessionBundleRepository = defaultSessionBundleRepository()) {}

  load(sessionId: SessionId): SessionFlowRecord | null {
    const bundle = this.bundleRepo.load(sessionId);
    if (!bundle) return null;
    return bundleToFlowRecord(sessionId, bundle);
  }

  save(record: SessionFlowRecord, jsonlPath?: string): void {
    this.bundleRepo.patch(record.sessionId, (bundle) => {
      bundle.meta.jsonlMtime = record.jsonlMtime;
      bundle.meta.workspaceRoot = record.workspaceRoot ?? bundle.meta.workspaceRoot;
      bundle.meta.updatedAt = record.updatedAt;
      bundle.session.flow = {
        revision: record.revision,
        fingerprint: record.fingerprint,
        flowGraph: record.flowGraph,
        flowchartHints: record.flowchartHints ?? {},
        graphPatchLedger: bundle.session.flow.graphPatchLedger ?? [],
      };
    }, jsonlPath);
  }

  clear(sessionId: SessionId): void {
    this.bundleRepo.clear(sessionId);
  }
}

/** @deprecated Use FileSessionFlowRepository */
export class FileGraphCacheRepository extends FileSessionFlowRepository {}

export type { GraphCacheRecord };
