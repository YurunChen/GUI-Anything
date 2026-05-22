/**
 * @deprecated Import from `data/wiki/summary-repository` — re-export for legacy paths.
 */
export {
  FileSummaryRepository,
  type SummaryRepository,
  type CachedSummary,
  type SummaryCacheData,
  type CacheLoadResult,
  loadSummaries,
  loadSummariesWithStatus,
  saveSummary,
  saveSummaries,
  cachedToSummaryItems,
  clearCache,
  clearAllCaches,
  getCacheStats,
} from '../../data/wiki/summary-repository';
