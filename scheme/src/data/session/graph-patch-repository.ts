import type { GraphPatch, SessionId } from '../protocol/observer-protocol';
import {
  ensureDir,
  sessionGraphPatchesPath,
  wikiSessionsDir,
} from '../wiki/wiki-data-layout';
import { deleteJsonFile, readJsonFile, writeJsonFile } from './json-io';

export interface GraphPatchLedger {
  sessionId: SessionId;
  updatedAt: number;
  patches: GraphPatch[];
}

export interface GraphPatchRepository {
  load(sessionId: SessionId): GraphPatchLedger | null;
  save(sessionId: SessionId, ledger: GraphPatchLedger): void;
  clear(sessionId: SessionId): void;
}

function getLedgerPath(sessionId: SessionId): string {
  return sessionGraphPatchesPath(sessionId);
}

function ensureSessionsDir(): void {
  ensureDir(wikiSessionsDir());
}

export class FileGraphPatchRepository implements GraphPatchRepository {
  load(sessionId: SessionId): GraphPatchLedger | null {
    const result = readJsonFile<GraphPatchLedger>(getLedgerPath(sessionId));
    if (result === null) return null;
    if (result === Symbol.for('corrupted') as unknown as GraphPatchLedger) {
      deleteJsonFile(getLedgerPath(sessionId));
      return null;
    }
    return result;
  }

  save(sessionId: SessionId, ledger: GraphPatchLedger): void {
    ensureSessionsDir();
    writeJsonFile(getLedgerPath(sessionId), ledger);
  }

  clear(sessionId: SessionId): void {
    deleteJsonFile(getLedgerPath(sessionId));
  }
}
