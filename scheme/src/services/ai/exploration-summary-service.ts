import { generateExplorationSummaryAI } from './flow-summaries';
import { mergeIntentTitleState } from './intent-title-merge';
import {
  finalizeExplorationSummaryItem,
  finalizeSummaryFromTimelineOnly,
} from './summary-display';
import {
  makeSessionScopedId,
  type Exploration,
  type SessionIntentState,
  type SessionScopedId,
  type SummaryItem,
} from '../../data/protocol/observer-protocol';
import {
  buildCardMetaFromExploration,
  bundleToSummaryItems,
  cardSummaryToSummaryItem,
  ensureExplorationRecord,
  summaryItemToCardSummary,
} from '../../data/wiki/session-bundle-mappers';
import { SUMMARY_REASON_FROM_SESSION_BUNDLE } from '../../data/protocol/summary-provenance';
import {
  type SessionBundleRepository,
} from '../../data/wiki/session-bundle-repository';
import type { BundleLoadResult } from '../../data/wiki/session-bundle-types';
import { getSessionIndexService } from '../session/session-index-service';
import { getSessionBundleRepository } from '../session/session-bundle-service';
import { jsonlMtimeMs } from '../session/session-flow-store';
import { createLogger } from '../../utils/logger';
import {
  ensureExplorationCardRetrieval,
  isExplorationRetrievalResolved,
} from '../session/exploration-card-pipeline';

const log = createLogger('summary');

export interface CacheHydrateResult {
  items: Record<SessionScopedId, SummaryItem>;
  cacheStatus: BundleLoadResult['status'];
  cacheReason: string;
}

export interface ExplorationSummaryService {
  hydrateFromBundle(sessionId: string, jsonlPath: string): CacheHydrateResult;
  generateMissing(input: {
    sessionId: string;
    explorations: Exploration[];
    jsonlPath: string;
    existing: Record<SessionScopedId, SummaryItem>;
    summaryModel?: string;
  }): Promise<Record<SessionScopedId, SummaryItem>>;
  resetSession(sessionId: string): void;
  pendingCount(): number;
  isExplorationPending(scopedId: SessionScopedId): boolean;
  getRuntimeStats(): SummaryRuntimeStats;
}

export interface SummaryRuntimeStats {
  queued: number;
  active: number;
  completed: number;
  failed: number;
  retried: number;
  avgDurationMs: number;
  maxConcurrentObserved: number;
}

type SummaryGenerator = (
  question: string,
  nodes: Exploration['nodes'],
  history: Array<{ question: string; summary?: string; toolCount: number; errorCount: number; status: 'complete' | 'interrupted' }>,
  model?: string,
  sessionIntent?: SessionIntentState | null,
) => Promise<SummaryGeneratorResult>;

type SummaryGeneratorResult = Awaited<ReturnType<typeof generateExplorationSummaryAI>> & {
  validationError?: string;
};

interface SummaryServiceOptions {
  maxConcurrency?: number;
  maxRetries?: number;
  generateSummary?: SummaryGenerator;
  bundleRepository?: SessionBundleRepository;
}

export class DefaultExplorationSummaryService implements ExplorationSummaryService {
  private pending = new Set<SessionScopedId>();
  private sessionId = '';
  private readonly maxConcurrency: number;
  private readonly maxRetries: number;
  private readonly generateSummary: SummaryGenerator;
  private readonly bundleRepo: SessionBundleRepository;
  private stats: SummaryRuntimeStats = {
    queued: 0,
    active: 0,
    completed: 0,
    failed: 0,
    retried: 0,
    avgDurationMs: 0,
    maxConcurrentObserved: 0,
  };

  constructor(options?: SummaryServiceOptions) {
    this.bundleRepo = options?.bundleRepository ?? getSessionBundleRepository();
    this.maxConcurrency = Math.max(1, options?.maxConcurrency ?? 3);
    this.maxRetries = Math.max(0, options?.maxRetries ?? 3);
    this.generateSummary = options?.generateSummary ?? generateExplorationSummaryAI;
  }

  resetSession(sessionId: string): void {
    if (sessionId === this.sessionId) return;
    log.debug('summary service reset session', { sessionId, previousSessionId: this.sessionId || undefined });
    this.sessionId = sessionId;
    this.pending.clear();
    this.stats = {
      queued: 0,
      active: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      avgDurationMs: 0,
      maxConcurrentObserved: 0,
    };
  }

  pendingCount(): number {
    return this.pending.size;
  }

  isExplorationPending(scopedId: SessionScopedId): boolean {
    return this.pending.has(scopedId);
  }

  getRuntimeStats(): SummaryRuntimeStats {
    return { ...this.stats };
  }

  hydrateFromBundle(sessionId: string, jsonlPath: string): CacheHydrateResult {
    const result = this.bundleRepo.loadWithStatus(sessionId, jsonlPath);
    const items = result.bundle ? bundleToSummaryItems(sessionId, result.bundle) : {};
    log.debug('bundle hydrated', {
      sessionId,
      cacheStatus: result.status,
      cacheReason: result.reason,
      itemCount: Object.keys(items).length,
    });
    return {
      items,
      cacheStatus: result.status,
      cacheReason: result.reason,
    };
  }

  async generateMissing(input: {
    sessionId: string;
    explorations: Exploration[];
    jsonlPath: string;
    existing: Record<SessionScopedId, SummaryItem>;
    summaryModel?: string;
  }): Promise<Record<SessionScopedId, SummaryItem>> {
    const generated: Record<SessionScopedId, SummaryItem> = {};
    const accumulated: Record<SessionScopedId, SummaryItem> = { ...input.existing };
    const bundle = this.bundleRepo.ensure(input.sessionId, input.jsonlPath);
    let sessionIntent = bundle.session.intent;

    for (const exploration of input.explorations) {
      if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
      const id = makeSessionScopedId(input.sessionId, exploration.id);
      if (accumulated[id]?.status === 'ready' && accumulated[id]?.text?.trim()) continue;
      if (this.pending.has(id)) continue;

      const bundleCard = bundle.explorations?.[exploration.id];
      if (bundleCard?.summary?.status === 'ready' && bundleCard.summary.text?.trim()) {
        if (!accumulated[id]) {
          accumulated[id] = {
            ...cardSummaryToSummaryItem(input.sessionId, exploration.id, bundleCard.summary),
            reason: SUMMARY_REASON_FROM_SESSION_BUNDLE,
          };
        }
        log.debug('reuse bundle summary', {
          sessionId: input.sessionId,
          explorationId: exploration.id,
        });
        continue;
      }

      if (!isExplorationRetrievalResolved(bundleCard)) {
        ensureExplorationCardRetrieval({
          sessionId: input.sessionId,
          exploration,
          jsonlPath: input.jsonlPath,
          allowLiveSearch: true,
          bundleRepository: this.bundleRepo,
        });
      }

      log.info('AI summary queued', {
        sessionId: input.sessionId,
        explorationId: exploration.id,
      });
      this.pending.add(id);
      this.stats.queued += 1;
      const history = buildHistoryContext(
        input.sessionId,
        input.explorations,
        exploration.id,
        accumulated,
      );
      this.stats.queued = Math.max(0, this.stats.queued - 1);
      this.stats.active += 1;
      this.stats.maxConcurrentObserved = Math.max(this.stats.maxConcurrentObserved, this.stats.active);
      const startedAt = Date.now();
      try {
        const payload = await this.generateWithRetry(
          exploration.question,
          exploration.nodes,
          history,
          input.summaryModel || undefined,
          sessionIntent,
        );
        const finalized = finalizeExplorationSummaryItem({
          question: exploration.question,
          nodes: exploration.nodes,
          payload,
        });
        const item: SummaryItem = {
          id,
          sessionId: input.sessionId,
          explorationId: exploration.id,
          text: finalized.text,
          source: finalized.source,
          status: finalized.status,
          persistMeta: finalized.persistMeta,
          flowchart: finalized.flowchart,
          reason: finalized.reason,
        };
        generated[id] = item;
        accumulated[id] = item;
        this.stats.completed += 1;
        const durationMs = Date.now() - startedAt;
        log.info('AI summary ready', {
          sessionId: input.sessionId,
          explorationId: exploration.id,
          status: item.status,
          source: item.source,
          hasFlowchart: Boolean(item.flowchart),
          intentKey: item.flowchart?.intentKey,
          titleDelta: item.flowchart?.titleDelta,
          durationMs,
          durationSec: Math.round(durationMs / 100) / 10,
        });
        this.saveExplorationCard(input.sessionId, input.jsonlPath, exploration, item, sessionIntent);
        if (item.flowchart) {
          sessionIntent = mergeIntentTitleState(sessionIntent, input.sessionId, {
            explorationId: exploration.id,
            hint: item.flowchart,
          });
        }
      } catch (error) {
        const errorReason = error instanceof Error ? error.message : 'ai_generation_failed';
        const finalized = finalizeSummaryFromTimelineOnly({
          question: exploration.question,
          nodes: exploration.nodes,
          errorReason,
        });
        const item: SummaryItem = {
          id,
          sessionId: input.sessionId,
          explorationId: exploration.id,
          text: finalized.text,
          source: finalized.source,
          status: finalized.status,
          persistMeta: finalized.persistMeta,
          flowchart: undefined,
          reason: finalized.reason,
        };
        generated[id] = item;
        accumulated[id] = item;
        this.stats.completed += 1;
        log.warn('AI summary failed → timeline fallback', {
          sessionId: input.sessionId,
          explorationId: exploration.id,
          errorReason,
          durationMs: Date.now() - startedAt,
        });
        this.saveExplorationCard(input.sessionId, input.jsonlPath, exploration, item, sessionIntent);
      } finally {
        const durationMs = Date.now() - startedAt;
        const totalRuns = this.stats.completed + this.stats.failed;
        this.stats.avgDurationMs = totalRuns <= 1
          ? durationMs
          : Math.round(((this.stats.avgDurationMs * (totalRuns - 1)) + durationMs) / totalRuns);
        this.stats.active = Math.max(0, this.stats.active - 1);
        this.pending.delete(id);
      }
    }

    this.stats.queued = 0;
    if (sessionIntent !== bundle.session.intent) {
      this.bundleRepo.patch(input.sessionId, (b) => {
        b.session.intent = sessionIntent;
      }, input.jsonlPath);
    }
    try {
      getSessionIndexService().touchLastSession({
        sessionId: input.sessionId,
        cwd: process.cwd(),
        jsonlMtime: jsonlMtimeMs(input.jsonlPath),
        bundleUpdatedAt: Date.now(),
      });
    } catch {
      // non-fatal
    }
    return generated;
  }

  private saveExplorationCard(
    sessionId: string,
    jsonlPath: string,
    exploration: Exploration,
    item: SummaryItem,
    sessionIntent: SessionIntentState | null,
  ): void {
    this.bundleRepo.patch(sessionId, (bundle) => {
      const record = ensureExplorationRecord(bundle, exploration.id, exploration.question);
      record.meta = buildCardMetaFromExploration(exploration);
      record.summary = summaryItemToCardSummary(item);
      bundle.session.intent = sessionIntent;
    }, jsonlPath);
  }

  private async generateWithRetry(
    question: string,
    nodes: Exploration['nodes'],
    history: Array<{ question: string; summary?: string; toolCount: number; errorCount: number; status: 'complete' | 'interrupted' }>,
    model?: string,
    sessionIntent?: SessionIntentState | null,
  ): Promise<SummaryGeneratorResult> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.generateSummary(question, nodes, history, model, sessionIntent);
        if (result.validationError && attempt < this.maxRetries) {
          lastError = new Error(`structured_output_${result.validationError}`);
          this.stats.retried += 1;
          continue;
        }
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          this.stats.retried += 1;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('ai_generation_failed');
  }
}

function buildHistoryContext(
  sessionId: string,
  explorations: Exploration[],
  currentId: string,
  summaries: Record<SessionScopedId, SummaryItem>,
): Array<{ question: string; summary?: string; toolCount: number; errorCount: number; status: 'complete' | 'interrupted' }> {
  const idx = explorations.findIndex((e) => e.id === currentId);
  return explorations
    .slice(Math.max(0, idx - 3), idx)
    .filter((item) => item.status === 'complete' || item.status === 'interrupted')
    .map((item) => {
      const scopedId = makeSessionScopedId(sessionId, item.id);
      const prior = summaries[scopedId];
      return {
        question: item.question,
        summary: prior?.status === 'ready' ? prior.text : undefined,
        toolCount: item.nodes.filter((n: Exploration['nodes'][number]) => n.type === 'tool').length,
        errorCount: item.nodes.filter((n: Exploration['nodes'][number]) => n.type === 'error' || n.status === 'error').length,
        status: item.status === 'interrupted' ? 'interrupted' : ('complete' as const),
      };
    });
}
