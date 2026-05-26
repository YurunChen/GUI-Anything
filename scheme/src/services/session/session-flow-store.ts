import * as fs from 'node:fs';
import type {
  FlowchartHint,
  SessionFlowRecord,
  SessionId,
} from '../../data/protocol/observer-protocol';
import { SESSION_FLOW_RECORD_VERSION } from '../../data/protocol/observer-protocol';
import {
  FileSessionFlowRepository,
  type SessionFlowRepository,
} from '../../data/session/session-flow-repository';
import { buildFlowGraphSnapshot } from '../../app/observer/view-model/flow-graph-builder';
import { resolveWorkspaceRootForCache } from '../../data/session/workspace-root';
import {
  buildGraphFingerprint,
  type GraphFingerprintInput,
} from '../../utils/graph-fingerprint';

export interface PersistSessionFlowInput extends GraphFingerprintInput {
  sessionId: SessionId;
  jsonlMtime: number;
  jsonlPath?: string;
}

export interface SessionFlowStore {
  load(sessionId: SessionId): SessionFlowRecord | null;
  persist(input: PersistSessionFlowInput): SessionFlowRecord;
}

export function buildSessionFlowRecord(input: PersistSessionFlowInput): SessionFlowRecord {
  const sessionId = input.sessionId;
  const flowchartHints = input.flowchartHints ?? {};
  const flowGraph = buildFlowGraphSnapshot({
    sessionId,
    explorations: input.explorations,
    summaries: input.summaries,
    flowchartHints,
    wikiPersistStatus: input.wikiPersistStatus,
  });
  const fingerprint = buildGraphFingerprint(input);
  return {
    version: SESSION_FLOW_RECORD_VERSION,
    sessionId,
    jsonlMtime: input.jsonlMtime,
    fingerprint,
    revision: 0,
    updatedAt: Date.now(),
    flowGraph,
    flowchartHints,
    workspaceRoot: resolveWorkspaceRootForCache(),
  };
}

export class DefaultSessionFlowStore implements SessionFlowStore {
  constructor(private readonly repository: SessionFlowRepository = new FileSessionFlowRepository()) {}

  load(sessionId: SessionId): SessionFlowRecord | null {
    return this.repository.load(sessionId);
  }

  persist(input: PersistSessionFlowInput): SessionFlowRecord {
    const next = buildSessionFlowRecord(input);
    const existing = this.repository.load(input.sessionId);
    next.revision = (existing?.revision ?? 0) + 1;
    this.repository.save(next, input.jsonlPath);
    return next;
  }
}

export function jsonlMtimeMs(jsonlPath: string): number {
  try {
    return fs.statSync(jsonlPath).mtimeMs;
  } catch {
    return 0;
  }
}

export function mergeFlowchartHints(
  base: Record<string, FlowchartHint>,
  overlay: Record<string, FlowchartHint>,
): Record<string, FlowchartHint> {
  return { ...base, ...overlay };
}
