import type {
  Exploration,
  IntentBucket,
  PersistResult,
  SessionScopedId,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';
import { shouldCurateWikiForIntent } from '../../constants/session-intent-keys';
import {
  IntentBucketService,
} from './intent-bucket-service';
import {
  buildIntentDigest,
  digestToExplorationSummary,
  findPriorHitForDigest,
  shouldSkipIntentCurate,
  type IntentDigest,
} from './intent-digest-service';
import {
  getWikiMaintenanceService,
  WikiMaintenanceService,
} from './wiki-maintenance-service';
import type { KnowledgeEntry } from '../../data/wiki/knowledge-repository';
import { KnowledgeRepository } from '../../data/wiki/knowledge-repository';
import { DefaultWikiMatchService } from './match-service';
import {
  resolveWikiDecisionAsync,
  type WikiAgentRunInput,
} from './wiki-agent/run';
import { appendKnowledgeLog } from '../../data/wiki/knowledge-log-service';
import { maybeRunWikiMaintainAfterIngest } from './wiki-maintain-service';

export interface CurateIntentInput {
  sessionId: string;
  intentKey: string;
  anchorExplorationId: string;
  summaries: Record<SessionScopedId, SummaryItem>;
  explorations: Exploration[];
}

export class WikiCuratorService {
  private bucketService: IntentBucketService;
  private maintenance: WikiMaintenanceService;
  private knowledgeRepo: KnowledgeRepository;
  private matchService: DefaultWikiMatchService;

  constructor(
    bucketService?: IntentBucketService,
    maintenance?: WikiMaintenanceService,
    knowledgeRepo?: KnowledgeRepository,
  ) {
    this.knowledgeRepo = knowledgeRepo ?? new KnowledgeRepository();
    this.matchService = new DefaultWikiMatchService(this.knowledgeRepo);
    this.bucketService = bucketService ?? new IntentBucketService();
    this.maintenance = maintenance ?? getWikiMaintenanceService();
  }

  async curateIntent(input: CurateIntentInput): Promise<PersistResult> {
    const scopedAnchor = makeSessionScopedId(input.sessionId, input.anchorExplorationId);
    const ledger = this.bucketService.load(input.sessionId);
    const bucket = ledger.buckets[input.intentKey];
    if (!bucket) {
      return { id: scopedAnchor, status: 'skipped', reason: 'missing_bucket' };
    }
    if (bucket.curatedAt) {
      return bucket.persistResult ?? { id: scopedAnchor, status: 'skipped', reason: 'already_curated' };
    }

    if (!shouldCurateWikiForIntent(input.intentKey)) {
      const result: PersistResult = {
        id: scopedAnchor,
        status: 'skipped',
        reason: 'intent_not_wiki_eligible',
      };
      this.bucketService.markCurated(input.sessionId, input.intentKey, input.anchorExplorationId, result);
      appendKnowledgeLog({ op: 'skip', reason: 'intent_not_wiki_eligible' });
      return result;
    }

    const skipReason = shouldSkipIntentCurate({
      sessionId: input.sessionId,
      bucket,
      summaries: input.summaries,
      explorations: input.explorations,
    });
    if (skipReason) {
      const result: PersistResult = { id: scopedAnchor, status: 'skipped', reason: skipReason };
      this.bucketService.markCurated(input.sessionId, input.intentKey, input.anchorExplorationId, result);
      appendKnowledgeLog({ op: 'skip', reason: `intent_curate:${skipReason}` });
      return result;
    }

    const digest = buildIntentDigest({
      sessionId: input.sessionId,
      bucket,
      summaries: input.summaries,
      explorations: input.explorations,
    });
    if (!digest) {
      const result: PersistResult = { id: scopedAnchor, status: 'skipped', reason: 'empty_digest' };
      this.bucketService.markCurated(input.sessionId, input.intentKey, input.anchorExplorationId, result);
      return result;
    }

    return this.runCurator(digest, bucket, input.anchorExplorationId, input.explorations);
  }

  private async runCurator(
    digest: IntentDigest,
    bucket: IntentBucket,
    anchorExplorationId: string,
    explorations: Exploration[],
  ): Promise<PersistResult> {
    const scopedAnchor = makeSessionScopedId(digest.sessionId, anchorExplorationId);
    const summary = digestToExplorationSummary(digest);
    const priorHit = findPriorHitForDigest(digest, explorations, digest.sessionId, this.matchService);
    const candidates = await this.loadAgentCandidates(digest, priorHit);
    const targetExcerpt = priorHit
      ? priorHit.entry.content.replace(/^---[\s\S]*?---\n?/, '').trim().slice(0, 1200)
      : undefined;

    const agentInput: WikiAgentRunInput = {
      digest,
      summary,
      priorHit,
      candidates,
      targetExcerpt,
    };

    const { decision, agentWroteDisk, manifest, source } = await resolveWikiDecisionAsync(agentInput);

    if (!decision || decision.action === 'skip') {
      const result: PersistResult = {
        id: scopedAnchor,
        status: 'skipped',
        reason: decision?.reason ?? 'agent_skip',
      };
      this.bucketService.markCurated(digest.sessionId, bucket.intentKey, anchorExplorationId, result);
      appendKnowledgeLog({ op: 'skip', reason: result.reason });
      return result;
    }

    const skillOnly = source === 'skill' || Boolean(digest);
    const { result } = await this.maintenance.applyAgentDecision({
      sessionId: digest.sessionId,
      explorationId: anchorExplorationId,
      summary,
      decision,
      priorHit,
      agentWroteDisk,
      manifest,
      skillOnly,
    });

    const enriched: PersistResult = {
      ...result,
      id: scopedAnchor,
    };
    this.bucketService.markCurated(digest.sessionId, bucket.intentKey, anchorExplorationId, enriched);

    if (result.status === 'saved' || result.status === 'updated') {
      void maybeRunWikiMaintainAfterIngest(this.knowledgeRepo.getRoot()).catch((err) => {
        console.error('[WikiCurator] maintain after ingest:', err);
      });
    }

    return enriched;
  }

  private async loadAgentCandidates(
    digest: IntentDigest,
    priorHit: ReturnType<typeof findPriorHitForDigest>,
  ): Promise<KnowledgeEntry[]> {
    const pool = this.knowledgeRepo.listMatchPoolSync();
    if (priorHit) {
      const rest = pool.filter((e) => e.id !== priorHit.entry.id).slice(0, 4);
      return [priorHit.entry, ...rest];
    }
    const query = digest.representativeQuestion?.trim();
    if (query && query.length >= 5) {
      const hit = this.matchService.searchByQuerySync(query, 0.25);
      if (hit) {
        return [hit.entry, ...pool.filter((e) => e.id !== hit.entry.id).slice(0, 4)];
      }
    }
    return pool.slice(0, 5);
  }
}

let defaultCurator: WikiCuratorService | null = null;

export function getWikiCuratorService(): WikiCuratorService {
  if (!defaultCurator) {
    defaultCurator = new WikiCuratorService();
  }
  return defaultCurator;
}
