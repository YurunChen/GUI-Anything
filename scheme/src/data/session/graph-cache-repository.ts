import type { FlowGraphSnapshot, SessionFlowRecord, SessionId } from '../protocol/observer-protocol';
import {
  FileSessionFlowRepository,
  type SessionFlowRepository,
} from './session-flow-repository';

/** @deprecated Use SessionFlowRecord */
export interface GraphCacheRecord {
  sessionId: SessionId;
  jsonlMtime: number;
  savedAt: number;
  fingerprint: string;
  snapshot: FlowGraphSnapshot;
}

export interface GraphCacheRepository {
  load(sessionId: SessionId): SessionFlowRecord | null;
  save(record: SessionFlowRecord): void;
  clear(sessionId: SessionId): void;
}

export class FileGraphCacheRepository implements GraphCacheRepository {
  constructor(private readonly inner: SessionFlowRepository = new FileSessionFlowRepository()) {}

  load(sessionId: SessionId): SessionFlowRecord | null {
    return this.inner.load(sessionId);
  }

  save(record: SessionFlowRecord): void {
    this.inner.save(record);
  }

  clear(sessionId: SessionId): void {
    this.inner.clear(sessionId);
  }
}
