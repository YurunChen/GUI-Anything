import type { IntentBucketLedger, SessionId } from '../protocol/observer-protocol';
import {
  ensureDir,
  sessionIntentBucketsPath,
  wikiSessionsDir,
} from './wiki-data-layout';
import { deleteJsonFile, readJsonFile, writeJsonFile } from '../session/json-io';

export interface IntentBucketRepository {
  load(sessionId: SessionId): IntentBucketLedger | null;
  save(ledger: IntentBucketLedger): void;
  clear(sessionId: SessionId): void;
}

function ensureSessionsDir(): void {
  ensureDir(wikiSessionsDir());
}

export class FileIntentBucketRepository implements IntentBucketRepository {
  load(sessionId: SessionId): IntentBucketLedger | null {
    const result = readJsonFile<IntentBucketLedger>(sessionIntentBucketsPath(sessionId));
    if (result === null) return null;
    if (result === Symbol.for('corrupted') as unknown as IntentBucketLedger) {
      deleteJsonFile(sessionIntentBucketsPath(sessionId));
      return null;
    }
    if (result.sessionId !== sessionId) {
      return { ...result, sessionId };
    }
    return result;
  }

  save(ledger: IntentBucketLedger): void {
    ensureSessionsDir();
    writeJsonFile(sessionIntentBucketsPath(ledger.sessionId), ledger);
  }

  clear(sessionId: SessionId): void {
    deleteJsonFile(sessionIntentBucketsPath(sessionId));
  }
}

export const defaultIntentBucketRepository = new FileIntentBucketRepository();
