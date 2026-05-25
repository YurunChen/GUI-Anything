import { generateExplorationSummaryAI } from './flow-summaries';
import { mergeIntentTitleState } from './intent-title-merge';
import {
  defaultSessionIntentRepository,
  type SessionIntentRepository,
} from '../../data/wiki/session-intent-repository';
import {
  finalizeExplorationSummaryItem,
  finalizeSummaryFromTimelineOnly,
} from './summary-display';
import {
  FileSummaryRepository,
  type SummaryRepository,
  type CacheLoadResult,
} from '../../data/wiki/summary-repository';
import {
  makeSessionScopedId,
  type Exploration,
  type SessionIntentState,
  type SessionScopedId,
  type SummaryItem,
} from '../../data/protocol/observer-protocol';
import { toExplorationFlowchartHintMap, toExplorationSummaryTextMap } from '../../data/protocol/summary-contract';
import {
  DefaultSessionFlowStore,
  jsonlMtimeMs,
  type SessionFlowStore,
} from '../session/session-flow-store';
import {
  KnowledgeRepository,
  type KnowledgeEntry,
} from '../../data/wiki/knowledge-repository';

export interface CacheHydrateResult {
  items: Record<SessionScopedId, SummaryItem>;
  /** Cache load status for provenance display */
  cacheStatus: CacheLoadResult['status'];
  /** Human-readable cache state description */
  cacheReason: string;
}

export interface ExplorationSummaryService {
  hydrateFromWiki(sessionId: string): Promise<Record<SessionScopedId, SummaryItem>>;
  hydrateFromCache(sessionId: string, jsonlPath: string): CacheHydrateResult;
  generateMissing(input: {
    sessionId: string;
    explorations: Exploration[];
    jsonlPath: string;
    existing: Record<SessionScopedId, SummaryItem>;
    summaryModel?: string;
  }): Promise<Record<SessionScopedId, SummaryItem>>;
  resetSession(sessionId: string): void;
  pendingCount(): number;
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
) => Promise<Awaited<ReturnType<typeof generateExplorationSummaryAI>>>;

interface SummaryServiceOptions {
  maxConcurrency?: number;
  maxAttempts?: number;
  generateSummary?: SummaryGenerator;
  summaryRepository?: SummaryRepository;
  intentRepository?: SessionIntentRepository;
  sessionFlowStore?: SessionFlowStore;
}

export class DefaultExplorationSummaryService implements ExplorationSummaryService {
  private pending = new Set<SessionScopedId>();
  private sessionId = '';
  private knowledgeRepo: KnowledgeRepository;
  private readonly maxConcurrency: number;
  private readonly maxAttempts: number;
  private readonly generateSummary: SummaryGenerator;
  private readonly summaryRepo: SummaryRepository;
  private readonly intentRepo: SessionIntentRepository;
  private readonly sessionFlowStore: SessionFlowStore;
  private stats: SummaryRuntimeStats = {
    queued: 0,
    active: 0,
    completed: 0,
    failed: 0,
    retried: 0,
    avgDurationMs: 0,
    maxConcurrentObserved: 0,
  };

  constructor(knowledgeRepo?: KnowledgeRepository, options?: SummaryServiceOptions) {
    this.knowledgeRepo = knowledgeRepo || new KnowledgeRepository();
    this.summaryRepo = options?.summaryRepository ?? new FileSummaryRepository();
    this.intentRepo = options?.intentRepository ?? defaultSessionIntentRepository;
    this.sessionFlowStore = options?.sessionFlowStore ?? new DefaultSessionFlowStore();
    // Summaries run sequentially for session continuity; option kept for API compat.
    this.maxConcurrency = Math.max(1, options?.maxConcurrency ?? 3);
    this.maxAttempts = Math.max(1, options?.maxAttempts ?? 2);
    this.generateSummary = options?.generateSummary ?? generateExplorationSummaryAI;
  }

  resetSession(sessionId: string): void {
    if (sessionId === this.sessionId) return;
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

  getRuntimeStats(): SummaryRuntimeStats {
    return { ...this.stats };
  }

  async hydrateFromWiki(sessionId: string): Promise<Record<SessionScopedId, SummaryItem>> {
    this.resetSession(sessionId);
    const entries = await this.knowledgeRepo.listAll();
    const items: Record<SessionScopedId, SummaryItem> = {};
    
    for (const entry of entries) {
      if (entry.sessionId !== sessionId) continue;
      const id = makeSessionScopedId(sessionId, entry.explorationId);
      // 从内容中提取摘要（简化处理，取第一段）
      const text = entry.content.match(/## 摘要\s*\n([\s\S]*?)\n##/)?.[1]?.trim() || 
                   entry.request;
      items[id] = {
        id,
        sessionId,
        explorationId: entry.explorationId,
        text,
        source: 'wiki',
        status: 'ready',
        persistMeta: null,
        flowchart: undefined,
      };
    }
    return items;
  }

  /**
   * Load summaries from cache if available and not expired.
   * Returns null if no cache exists or cache is expired.
   */
  hydrateFromCache(
    sessionId: string,
    jsonlPath: string,
    options?: { preserveStale?: boolean },
  ): CacheHydrateResult {
    this.resetSession(sessionId);
    const result = this.summaryRepo.loadWithStatus(sessionId, jsonlPath, {
      onExpired: options?.preserveStale ? 'stale' : 'clear',
    });
    const items = result.data ? this.summaryRepo.toSummaryItems(sessionId, result.data) : {};
    if (result.status === 'stale') {
      for (const item of Object.values(items)) {
        item.reason = 'jsonl_modified_since_cache';
      }
    }
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
    this.resetSession(input.sessionId);
    const generated: Record<SessionScopedId, SummaryItem> = {};
    /** Same-session prior summaries — updated after each exploration (sequential 心流). */
    const accumulated: Record<SessionScopedId, SummaryItem> = { ...input.existing };
    let sessionIntent = this.intentRepo.load(input.sessionId);

    for (const exploration of input.explorations) {
      if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
      const id = makeSessionScopedId(input.sessionId, exploration.id);
      if (accumulated[id]?.status === 'ready' || this.pending.has(id)) continue;

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
        this.summaryRepo.saveOne(input.sessionId, input.jsonlPath, exploration.id, item);
        if (item.flowchart) {
          sessionIntent = mergeIntentTitleState(sessionIntent, input.sessionId, {
            explorationId: exploration.id,
            hint: item.flowchart,
          });
          this.intentRepo.save(sessionIntent);
        }
        this.persistSessionFlow(input, accumulated);
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
        this.summaryRepo.saveOne(input.sessionId, input.jsonlPath, exploration.id, item);
        this.persistSessionFlow(input, accumulated);
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
    return generated;
  }

  private async generateWithRetry(
    question: string,
    nodes: Exploration['nodes'],
    history: Array<{ question: string; summary?: string; toolCount: number; errorCount: number; status: 'complete' | 'interrupted' }>,
    model?: string,
    sessionIntent?: SessionIntentState | null,
  ): Promise<Awaited<ReturnType<typeof generateExplorationSummaryAI>>> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.generateSummary(question, nodes, history, model, sessionIntent);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxAttempts) {
          this.stats.retried += 1;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('ai_generation_failed');
  }

  private persistSessionFlow(
    input: {
      sessionId: string;
      explorations: Exploration[];
      jsonlPath: string;
    },
    accumulated: Record<SessionScopedId, SummaryItem>,
  ): void {
    if (!input.sessionId || !input.jsonlPath) return;
    const mtime = jsonlMtimeMs(input.jsonlPath);
    if (mtime <= 0) return;
    try {
      this.sessionFlowStore.persist({
        sessionId: input.sessionId,
        jsonlMtime: mtime,
        explorations: input.explorations,
        summaries: toExplorationSummaryTextMap(accumulated),
        flowchartHints: toExplorationFlowchartHintMap(accumulated),
      });
    } catch {
      // Non-fatal: observer can rebuild from summaries on next load.
    }
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
