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
  hydrateFromCache(sessionId: string, jsonlPath: string): CacheHydrateResult | null;
  generateMissing(input: {
    sessionId: string;
    explorations: Exploration[];
    jsonlPath: string;
    existing: Record<SessionScopedId, SummaryItem>;
    summaryModel?: string;
  }): Promise<Record<SessionScopedId, SummaryItem>>;
  resetSession(sessionId: string): void;
  pendingCount(): number;
}

export class DefaultExplorationSummaryService implements ExplorationSummaryService {
  private pending = new Set<SessionScopedId>();
  private sessionId = '';
  private knowledgeRepo: KnowledgeRepository;

  constructor(knowledgeRepo?: KnowledgeRepository) {
    this.knowledgeRepo = knowledgeRepo || new KnowledgeRepository();
  }

  resetSession(sessionId: string): void {
    if (sessionId === this.sessionId) return;
    this.sessionId = sessionId;
    this.pending.clear();
  }

  pendingCount(): number {
    return this.pending.size;
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
      };
    }
    return items;
  }

  /**
   * Load summaries from cache if available and not expired.
   * Returns null if no cache exists or cache is expired.
   */
  hydrateFromCache(sessionId: string, jsonlPath: string): CacheHydrateResult | null {
    this.resetSession(sessionId);
    const result = loadSummariesWithStatus(sessionId, jsonlPath);
    if (!result.data) {
      return null;
    }
    return {
      items: cachedToSummaryItems(sessionId, result.data),
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
    const tasks: Array<Promise<void>> = [];

    for (const exploration of input.explorations) {
      if (exploration.status !== 'complete' || exploration.nodes.length === 0) continue;
      const id = makeSessionScopedId(input.sessionId, exploration.id);
      if (input.existing[id] || this.pending.has(id)) continue;

      this.pending.add(id);
      const history = buildHistoryContext(input.explorations, exploration.id, input.existing);
      tasks.push(
        generateExplorationSummaryAI(
          exploration.question,
          exploration.nodes,
          history,
          input.summaryModel || undefined,
        )
          .then((payload) => {
            // 检查是否有结构化输出校验错误
            const hasValidationError = 'validationError' in payload && payload.validationError;
            const item: SummaryItem = {
              id,
              sessionId: input.sessionId,
              explorationId: exploration.id,
              text: payload.displaySummary,
              source: hasValidationError ? 'fallback' : 'ai',
              status: 'ready',
              persistMeta: payload.persist,
              reason: hasValidationError ? `structured_output_${payload.validationError}` : undefined,
            };
            generated[id] = item;
            // Save to cache immediately after generation
            saveSummary(input.sessionId, input.jsonlPath, exploration.id, item);
          })
          .catch((error) => {
            const errorReason = error instanceof Error ? error.message : 'ai_generation_failed';
            const item: SummaryItem = {
              id,
              sessionId: input.sessionId,
              explorationId: exploration.id,
              text: '（摘要生成失败）',
              source: 'fallback',
              status: 'failed',
              persistMeta: null,
              reason: errorReason,
            };
            generated[id] = item;
            // Save failed status to cache as well
            saveSummary(input.sessionId, input.jsonlPath, exploration.id, item);
          })
          .finally(() => {
            this.pending.delete(id);
          }),
      );
    }

    await Promise.all(tasks);
    return generated;
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
