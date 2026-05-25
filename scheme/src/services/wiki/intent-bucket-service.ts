import type {
  ExplorationId,
  FlowchartHint,
  IntentBucket,
  IntentBucketLedger,
  PersistResult,
  SessionId,
  SessionIntentState,
} from '../../data/protocol/observer-protocol';
import {
  FileIntentBucketRepository,
  type IntentBucketRepository,
} from '../../data/wiki/intent-bucket-repository';
import { resolveTitleDelta } from '../ai/intent-title-merge';
import { catalogIntentKeyFromHint } from '../../data/protocol/flowchart-intent';

export interface RecordSummaryBucketInput {
  sessionId: SessionId;
  explorationId: ExplorationId;
  hint: FlowchartHint;
  priorIntent: SessionIntentState | null;
  nodeTitle: string;
}

export interface RecordSummaryBucketResult {
  ledger: IntentBucketLedger;
  /** Intent key to curate (closed on pivot), if any */
  curateIntentKey: string | null;
  anchorExplorationId: ExplorationId | null;
}

export class IntentBucketService {
  constructor(private readonly repo: IntentBucketRepository = new FileIntentBucketRepository()) {}

  load(sessionId: SessionId): IntentBucketLedger {
    return this.repo.load(sessionId) ?? emptyLedger(sessionId);
  }

  save(ledger: IntentBucketLedger): void {
    this.repo.save({ ...ledger, updatedAt: Date.now() });
  }

  recordSummary(input: RecordSummaryBucketInput): RecordSummaryBucketResult {
    const ledger = this.load(input.sessionId);
    const delta = resolveTitleDelta(input.priorIntent, input.hint);
    const hintKey = catalogIntentKeyFromHint(input.hint);
    let openKey = ledger.openIntentKey || input.priorIntent?.intentKey || hintKey;

    if (!ledger.openIntentKey) {
      openKey = input.priorIntent?.intentKey || hintKey;
      ledger.openIntentKey = openKey;
    }

    ensureBucket(ledger, openKey, input.nodeTitle || input.hint.nodeTitle);
    appendExploration(ledger.buckets[openKey], input.explorationId);

    let curateIntentKey: string | null = null;
    let anchorExplorationId: ExplorationId | null = null;

    if (delta === 'pivot' && input.priorIntent && !isGreetingIntent(input.priorIntent)) {
      const closedKey = openKey;
      if (ledger.buckets[closedKey] && !ledger.buckets[closedKey].curatedAt) {
        curateIntentKey = closedKey;
        anchorExplorationId = input.explorationId;
      }
      ledger.openIntentKey = hintKey;
      ensureBucket(ledger, hintKey, input.hint.nodeTitle);
    } else if (delta === 'pivot' && (!input.priorIntent || isGreetingIntent(input.priorIntent))) {
      ledger.openIntentKey = hintKey;
      ensureBucket(ledger, hintKey, input.hint.nodeTitle);
    }

    ledger.updatedAt = Date.now();
    this.save(ledger);

    return { ledger, curateIntentKey, anchorExplorationId };
  }

  markCurated(
    sessionId: SessionId,
    intentKey: string,
    anchorExplorationId: ExplorationId,
    result: PersistResult,
  ): IntentBucketLedger {
    const ledger = this.load(sessionId);
    const bucket = ledger.buckets[intentKey];
    if (bucket) {
      bucket.curatedAt = Date.now();
      bucket.anchorExplorationId = anchorExplorationId;
      bucket.persistResult = result;
    }
    ledger.updatedAt = Date.now();
    this.save(ledger);
    return ledger;
  }

  getOpenUncuratedBucket(ledger: IntentBucketLedger): IntentBucket | null {
    const bucket = ledger.buckets[ledger.openIntentKey];
    if (!bucket || bucket.curatedAt) return null;
    if (bucket.explorationIds.length === 0) return null;
    return bucket;
  }
}

function emptyLedger(sessionId: SessionId): IntentBucketLedger {
  return {
    sessionId,
    openIntentKey: '',
    buckets: {},
    updatedAt: Date.now(),
  };
}

function ensureBucket(ledger: IntentBucketLedger, intentKey: string, nodeTitle: string): void {
  if (!ledger.buckets[intentKey]) {
    ledger.buckets[intentKey] = {
      intentKey,
      nodeTitle,
      explorationIds: [],
    };
  } else if (nodeTitle.trim()) {
    ledger.buckets[intentKey].nodeTitle = nodeTitle;
  }
}

function appendExploration(bucket: IntentBucket, explorationId: ExplorationId): void {
  if (!bucket.explorationIds.includes(explorationId)) {
    bucket.explorationIds.push(explorationId);
  }
}

function isGreetingIntent(intent: SessionIntentState): boolean {
  return intent.intentKey === 'greeting' || intent.phase === 'idle';
}

export function isLegacyPerTurnWikiEnabled(): boolean {
  const raw = (process.env.FLOW_WIKI_LEGACY_PER_TURN || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
