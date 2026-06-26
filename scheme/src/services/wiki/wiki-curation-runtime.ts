import type {
  Exploration,
  ExplorationId,
  IntentBucketLedger,
  PersistResult,
  SessionIntentState,
  SessionScopedId,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';
import { normalizeSummaryItems } from '../../data/protocol/summary-contract';
import { intentBeforeExploration } from '../../data/protocol/session-intent-state';
import { shouldCurateWikiForIntent } from '../../constants/session-intent-keys';
import { getSessionBundleService, type SessionBundleService } from '../session/session-bundle-service';
import { isSummaryReadyForWiki } from './wiki-persist-policy';
import { IntentBucketService } from './intent-bucket-service';
import { getWikiCuratorService, type WikiCuratorService } from './wiki-curator-service';

export interface WikiCurationRequest {
  intentKey: string;
  anchorExplorationId: ExplorationId;
}

export interface RecordReadySummariesInput {
  sessionId: string;
  explorations: Exploration[];
  summaryItems: Record<SessionScopedId, SummaryItem>;
  sessionIntent: SessionIntentState | null;
  recordedSummaries: Set<SessionScopedId>;
}

export interface RecordReadySummariesResult {
  items: Record<SessionScopedId, SummaryItem>;
  ledger: IntentBucketLedger;
  requests: WikiCurationRequest[];
}

export interface CurateIntentRuntimeInput {
  sessionId: string;
  intentKey: string;
  anchorExplorationId: ExplorationId;
  items: Record<SessionScopedId, SummaryItem>;
  explorations: Exploration[];
}

export interface CurateIntentRuntimeResult {
  result: PersistResult;
  ledger: IntentBucketLedger;
}

export interface ResolveIdleSweepInput {
  sessionId: string;
  now: number;
  lastCompleteAt: number;
  idleMs: number;
}

export interface ResolveIdleSweepResult {
  ledger: IntentBucketLedger | null;
  request: WikiCurationRequest | null;
}

export class WikiCurationRuntime {
  constructor(
    private readonly bucketService = new IntentBucketService(),
    private readonly curator = getWikiCuratorService(),
    private readonly bundleService: SessionBundleService = getSessionBundleService(),
  ) {}

  loadLedger(sessionId: string): IntentBucketLedger | null {
    return sessionId ? this.bucketService.load(sessionId) : null;
  }

  recordReadySummaries(input: RecordReadySummariesInput): RecordReadySummariesResult {
    const items = normalizeSummaryItems(input.sessionId, input.summaryItems);
    let ledger = this.bucketService.load(input.sessionId);
    const requests: WikiCurationRequest[] = [];

    for (const exploration of input.explorations) {
      if (exploration.status !== 'complete') continue;
      const scopedId = makeSessionScopedId(input.sessionId, exploration.id);
      const item = items[scopedId];
      if (!item?.flowchart || !isSummaryReadyForWiki(item)) continue;
      if (input.recordedSummaries.has(scopedId)) continue;

      const priorIntent = intentBeforeExploration(input.sessionIntent, exploration.id);
      const record = this.bucketService.recordSummary({
        sessionId: input.sessionId,
        explorationId: exploration.id,
        hint: item.flowchart,
        priorIntent,
        nodeTitle: item.flowchart.nodeTitle,
      });
      ledger = record.ledger;
      input.recordedSummaries.add(scopedId);

      if (record.curateIntentKey && record.anchorExplorationId) {
        if (shouldCurateWikiForIntent(record.curateIntentKey)) {
          requests.push({
            intentKey: record.curateIntentKey,
            anchorExplorationId: record.anchorExplorationId,
          });
        } else {
          ledger = this.closeIneligibleIntentBucket(
            input.sessionId,
            record.curateIntentKey,
            record.anchorExplorationId,
          );
        }
      }
    }

    return { items, ledger, requests };
  }

  async curateIntent(input: CurateIntentRuntimeInput): Promise<CurateIntentRuntimeResult> {
    const result = await this.curator.curateIntent({
      sessionId: input.sessionId,
      intentKey: input.intentKey,
      anchorExplorationId: input.anchorExplorationId,
      summaries: input.items,
      explorations: input.explorations,
    });
    const ledger = this.bucketService.load(input.sessionId);
    this.syncWriteFieldsFromLedger(input.sessionId, ledger);
    return { result, ledger };
  }

  resolveIdleSweep(input: ResolveIdleSweepInput): ResolveIdleSweepResult {
    const ledger = this.bucketService.load(input.sessionId);
    const openBucket = this.bucketService.getOpenUncuratedBucket(ledger);
    if (!openBucket) return { ledger, request: null };

    const anchorExplorationId = openBucket.explorationIds[openBucket.explorationIds.length - 1];
    if (!anchorExplorationId) return { ledger, request: null };
    if (input.now - input.lastCompleteAt < input.idleMs) return { ledger, request: null };

    if (shouldCurateWikiForIntent(openBucket.intentKey)) {
      return {
        ledger,
        request: {
          intentKey: openBucket.intentKey,
          anchorExplorationId,
        },
      };
    }

    return {
      ledger: this.closeIneligibleIntentBucket(input.sessionId, openBucket.intentKey, anchorExplorationId),
      request: null,
    };
  }

  closeIneligibleIntentBucket(
    sessionId: string,
    intentKey: string,
    anchorExplorationId: ExplorationId,
  ): IntentBucketLedger {
    return this.bucketService.markCurated(sessionId, intentKey, anchorExplorationId, {
      id: makeSessionScopedId(sessionId, anchorExplorationId),
      status: 'skipped',
      reason: 'intent_not_wiki_eligible',
    });
  }

  private syncWriteFieldsFromLedger(sessionId: string, ledger: IntentBucketLedger | null): void {
    if (!ledger) return;
    for (const bucket of Object.values(ledger.buckets)) {
      if (!bucket.persistResult || !bucket.anchorExplorationId) continue;
      this.bundleService.patchExploration(sessionId, bucket.anchorExplorationId, {
        write: {
          origin: 'saved',
          status: bucket.persistResult.status,
          reason: bucket.persistResult.reason,
          targetId: bucket.persistResult.id,
          targetPath: bucket.persistResult.path,
          completedAt: bucket.curatedAt ?? Date.now(),
        },
      });
    }
  }
}
