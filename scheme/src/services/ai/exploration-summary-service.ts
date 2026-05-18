import { generateExplorationSummaryAI } from './flow-summaries';
import {
  loadSummaries,
  loadSummariesWithStatus,
  saveSummary,
  saveSummaries,
  cachedToSummaryItems,
  type SummaryCacheData,
  type CacheLoadResult,
} from './summary-cache';
import {
  makeSessionScopedId,
  type Exploration,
  type SessionScopedId,
  type SummaryItem,
} from '../../data/protocol/observer-protocol';
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
) => Promise<Awaited<ReturnType<typeof generateExplorationSummaryAI>>>;

interface SummaryServiceOptions {
  maxConcurrency?: number;
  maxAttempts?: number;
  generateSummary?: SummaryGenerator;
  saveSummary?: typeof saveSummary;
}

export class DefaultExplorationSummaryService implements ExplorationSummaryService {
  private pending = new Set<SessionScopedId>();
  private sessionId = '';
  private knowledgeRepo: KnowledgeRepository;
  private readonly maxConcurrency: number;
  private readonly maxAttempts: number;
  private readonly generateSummary: SummaryGenerator;
  private readonly saveSummaryFn: typeof saveSummary;
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
    this.maxConcurrency = Math.max(1, options?.maxConcurrency ?? 3);
    this.maxAttempts = Math.max(1, options?.maxAttempts ?? 2);
    this.generateSummary = options?.generateSummary ?? generateExplorationSummaryAI;
    this.saveSummaryFn = options?.saveSummary ?? saveSummary;
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
  hydrateFromCache(sessionId: string, jsonlPath: string): CacheHydrateResult {
    this.resetSession(sessionId);
    const result = loadSummariesWithStatus(sessionId, jsonlPath);
    return {
      items: result.data ? cachedToSummaryItems(sessionId, result.data) : {},
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
    const tasks: Array<() => Promise<void>> = [];

    for (const exploration of input.explorations) {
      if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
      const id = makeSessionScopedId(input.sessionId, exploration.id);
      if (input.existing[id] || this.pending.has(id)) continue;

      this.pending.add(id);
      const history = buildHistoryContext(input.explorations, exploration.id, input.existing);
      this.stats.queued += 1;
      tasks.push(async () => {
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
          );
          const hasValidationError = 'validationError' in payload && payload.validationError;
          const item: SummaryItem = {
            id,
            sessionId: input.sessionId,
            explorationId: exploration.id,
            text: payload.displaySummary,
            source: hasValidationError ? 'fallback' : 'ai',
            status: 'ready',
            persistMeta: payload.persist,
            flowchart: payload.flowchart,
            reason: hasValidationError ? `structured_output_${payload.validationError}` : undefined,
          };
          generated[id] = item;
          this.stats.completed += 1;
          this.saveSummaryFn(input.sessionId, input.jsonlPath, exploration.id, item);
        } catch (error) {
          const errorReason = error instanceof Error ? error.message : 'ai_generation_failed';
          const item: SummaryItem = {
            id,
            sessionId: input.sessionId,
            explorationId: exploration.id,
            text: '（摘要生成失败）',
            source: 'fallback',
            status: 'failed',
            persistMeta: null,
            flowchart: undefined,
            reason: errorReason,
          };
          generated[id] = item;
          this.stats.failed += 1;
          this.saveSummaryFn(input.sessionId, input.jsonlPath, exploration.id, item);
        } finally {
          const durationMs = Date.now() - startedAt;
          const totalRuns = this.stats.completed + this.stats.failed;
          this.stats.avgDurationMs = totalRuns <= 1
            ? durationMs
            : Math.round(((this.stats.avgDurationMs * (totalRuns - 1)) + durationMs) / totalRuns);
          this.stats.active = Math.max(0, this.stats.active - 1);
          this.pending.delete(id);
        }
      });
    }

    await runTasksWithLimit(tasks, this.maxConcurrency);
    this.stats.queued = 0;
    return generated;
  }

  private async generateWithRetry(
    question: string,
    nodes: Exploration['nodes'],
    history: Array<{ question: string; summary?: string; toolCount: number; errorCount: number; status: 'complete' | 'interrupted' }>,
    model?: string,
  ): Promise<Awaited<ReturnType<typeof generateExplorationSummaryAI>>> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.generateSummary(question, nodes, history, model);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxAttempts) {
          this.stats.retried += 1;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('ai_generation_failed');
  }
}

function buildHistoryContext(
  explorations: Exploration[],
  currentId: string,
  summaries: Record<SessionScopedId, SummaryItem>,
): Array<{ question: string; summary?: string; toolCount: number; errorCount: number; status: 'complete' | 'interrupted' }> {
  const idx = explorations.findIndex((e) => e.id === currentId);
  return explorations
    .slice(Math.max(0, idx - 3), idx)
    .filter((item) => item.status === 'complete' || item.status === 'interrupted')
    .map((item) => ({
      question: item.question,
      summary: Object.values(summaries).find((summary) => summary.explorationId === item.id)?.text,
      toolCount: item.nodes.filter((n) => n.type === 'tool').length,
      errorCount: item.nodes.filter((n) => n.type === 'error' || n.status === 'error').length,
      status: item.status === 'interrupted' ? 'interrupted' : ('complete' as const),
    }));
}

async function runTasksWithLimit(
  tasks: Array<() => Promise<void>>,
  limit: number,
): Promise<void> {
  if (tasks.length === 0) return;
  const concurrency = Math.max(1, Math.min(limit, tasks.length));
  let index = 0;
  const workers: Array<Promise<void>> = [];
  const runWorker = async () => {
    while (index < tasks.length) {
      const taskIndex = index;
      index += 1;
      await tasks[taskIndex]();
    }
  };
  for (let i = 0; i < concurrency; i++) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
}
