import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GraphPatch, SessionId } from '../protocol/observer-protocol';
import { resolveWikiRoot } from '../env';

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

function getRuntimeDir(): string {
  return path.join(resolveWikiRoot(), 'runtime');
}

function getLedgerPath(sessionId: SessionId): string {
  return path.join(getRuntimeDir(), `${sessionId}-graph-patches.json`);
}

function ensureRuntimeDir(): void {
  const dir = getRuntimeDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class FileGraphPatchRepository implements GraphPatchRepository {
  load(sessionId: SessionId): GraphPatchLedger | null {
    const filePath = getLedgerPath(sessionId);
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as GraphPatchLedger;
    } catch {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore cleanup errors.
      }
      return null;
    }
  }

  save(sessionId: SessionId, ledger: GraphPatchLedger): void {
    ensureRuntimeDir();
    const filePath = getLedgerPath(sessionId);
    fs.writeFileSync(filePath, JSON.stringify(ledger, null, 2), 'utf-8');
  }

  clear(sessionId: SessionId): void {
    const filePath = getLedgerPath(sessionId);
    if (!fs.existsSync(filePath)) return;
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore cleanup errors.
    }
  }
}
