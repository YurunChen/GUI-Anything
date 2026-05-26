import * as path from 'node:path';
import type { GraphPatch, SessionId } from '../protocol/observer-protocol';
import {
  defaultSessionBundleRepository,
  type SessionBundleRepository,
} from '../wiki/session-bundle-repository';

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

export class BundleGraphPatchRepository implements GraphPatchRepository {
  constructor(private readonly bundleRepo: SessionBundleRepository = defaultSessionBundleRepository()) {}

  load(sessionId: SessionId): GraphPatchLedger | null {
    const bundle = this.bundleRepo.load(sessionId);
    if (!bundle) return null;
    return {
      sessionId,
      updatedAt: bundle.meta.updatedAt,
      patches: bundle.session.flow.graphPatchLedger ?? [],
    };
  }

  save(sessionId: SessionId, ledger: GraphPatchLedger): void {
    this.bundleRepo.patch(sessionId, (bundle) => {
      bundle.session.flow.graphPatchLedger = ledger.patches;
    });
  }

  clear(sessionId: SessionId): void {
    this.bundleRepo.patch(sessionId, (bundle) => {
      bundle.session.flow.graphPatchLedger = [];
    });
  }
}

export class FileGraphPatchRepository extends BundleGraphPatchRepository {}
