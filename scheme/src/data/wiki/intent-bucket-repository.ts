import type {
  ExplorationId,
  IntentBucketLedger,
  PersistResult,
  SessionId,
} from '../../data/protocol/observer-protocol';
import {
  defaultSessionBundleRepository,
  type SessionBundleRepository,
} from '../../data/wiki/session-bundle-repository';

export interface IntentBucketRepository {
  load(sessionId: SessionId): IntentBucketLedger | null;
  save(ledger: IntentBucketLedger): void;
  clear(sessionId: SessionId): void;
}

export class BundleIntentBucketRepository implements IntentBucketRepository {
  constructor(private readonly bundleRepo: SessionBundleRepository = defaultSessionBundleRepository()) {}

  load(sessionId: SessionId): IntentBucketLedger | null {
    const bundle = this.bundleRepo.load(sessionId);
    if (!bundle) return null;
    return {
      sessionId,
      openIntentKey: bundle.curation.openIntentKey,
      buckets: bundle.curation.buckets,
      updatedAt: bundle.meta.updatedAt,
    };
  }

  save(ledger: IntentBucketLedger): void {
    this.bundleRepo.patch(ledger.sessionId, (bundle) => {
      bundle.curation.openIntentKey = ledger.openIntentKey;
      bundle.curation.buckets = ledger.buckets;
    });
  }

  clear(sessionId: SessionId): void {
    this.bundleRepo.patch(sessionId, (bundle) => {
      bundle.curation = { openIntentKey: '', buckets: {}, evidence: bundle.curation.evidence };
    });
  }
}

export const defaultIntentBucketRepository = new BundleIntentBucketRepository();

/** @deprecated Use BundleIntentBucketRepository */
export { BundleIntentBucketRepository as FileIntentBucketRepository };
