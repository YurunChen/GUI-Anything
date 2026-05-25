import type { WikiMatch as ProtocolWikiMatch } from '../../data/protocol/wiki-types';
import { resolveProjectTag } from '../../data/env';
import { formatFlowText } from '../../utils/flow-text';
import {
  KnowledgeRepository,
  type KnowledgeEntry,
} from '../../data/wiki/knowledge-repository';
import {
  filterPriorKnowledge,
  type WikiRetrievalTurn,
} from './wiki-retrieval-policy';

export interface WikiSearchOptions {
  /** Skip entries written for this session+exploration (post-save artifact). */
  excludeTurn?: WikiRetrievalTurn;
}

export interface WikiMatchService {
  searchByQuery(query: string, threshold: number, options?: WikiSearchOptions): Promise<ProtocolWikiMatch | null>;
  searchByQuerySync(query: string, threshold?: number, options?: WikiSearchOptions): ProtocolWikiMatch | null;
}

const GENERIC_QUERY_PATTERN =
  /^(分析|看看|了解|介绍|梳理|总结|review|analyze|summarize|describe).*(项目|代码库|仓库|codebase|project|repo|当前)/i;

/** Strip filler particles / whitespace so CJK queries like「分析下当前项目」≈「分析下当前的项目」. */
function normalizeMatchText(text: string): string {
  return formatFlowText(text)
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[的了吗呢啊吧着过]/g, '');
}

function extractCjkSubTokens(text: string): string[] {
  const segments = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const tokens: string[] = [];
  for (const segment of segments) {
    tokens.push(segment);
    if (segment.length >= 4) {
      for (let size = 2; size <= Math.min(3, segment.length - 1); size++) {
        for (let i = 0; i <= segment.length - size; i++) {
          tokens.push(segment.slice(i, i + size));
        }
      }
    }
  }
  return tokens;
}

function extractQueryTokens(query: string): string[] {
  const queryLower = formatFlowText(query).toLowerCase();
  const compact = normalizeMatchText(query);
  const spaceWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  return [...new Set([
    ...spaceWords,
    ...queryLower.match(/[a-z0-9]{3,}/g) || [],
    ...queryLower.match(/[\u4e00-\u9fa5]{2,}/g) || [],
    ...compact.match(/[\u4e00-\u9fa5]{2,}/g) || [],
    ...extractCjkSubTokens(compact),
  ])].filter((token) => token.length >= 2);
}

function requestSimilarity(query: string, request: string): number {
  const normalizedQuery = normalizeMatchText(query);
  const normalizedRequest = normalizeMatchText(request);
  if (!normalizedQuery || !normalizedRequest) return 0;
  if (normalizedQuery === normalizedRequest) return 1;

  const shorter = normalizedQuery.length <= normalizedRequest.length ? normalizedQuery : normalizedRequest;
  const longer = shorter === normalizedQuery ? normalizedRequest : normalizedQuery;
  if (longer.includes(shorter) && shorter.length >= 4) {
    return 0.85;
  }

  const queryTokens = extractQueryTokens(query);
  const requestTokens = extractQueryTokens(request);
  if (queryTokens.length === 0 || requestTokens.length === 0) return 0;

  const requestSet = new Set(requestTokens.map(normalizeMatchText));
  let overlap = 0;
  for (const token of queryTokens) {
    if (requestSet.has(normalizeMatchText(token))) overlap++;
  }
  return overlap / Math.max(queryTokens.length, requestTokens.length);
}

function isGenericQuery(query: string): boolean {
  return GENERIC_QUERY_PATTERN.test(query.trim());
}

function extractProjTag(tags: string[] | undefined): string | null {
  return (tags || []).find((tag) => tag.startsWith('proj:')) || null;
}

function calculateRelevanceScore(query: string, entry: KnowledgeEntry): number {
  const allWords = extractQueryTokens(query);
  if (allWords.length === 0) return 0;

  const requestNorm = normalizeMatchText(entry.request);
  const contentNorm = normalizeMatchText(entry.content);
  const tagsLower = (entry.tags || []).map((t) => t.toLowerCase()).join(' ');

  let matches = 0;
  let titleMatches = 0;

  for (const word of allWords) {
    const token = normalizeMatchText(word);
    if (!token) continue;
    if (requestNorm.includes(token)) {
      titleMatches++;
      matches++;
    } else if (contentNorm.includes(token)) {
      matches++;
    } else if (tagsLower.includes(token)) {
      matches++;
    }
  }

  const keywordScore = matches / allWords.length;
  const reqSim = requestSimilarity(query, entry.request);
  let score = keywordScore * 0.55 + reqSim * 0.45;

  const titleBoost = titleMatches > 0 ? 0.1 : 0;
  score = Math.min(1, score + titleBoost);

  const currentProj = resolveProjectTag();
  const entryProj = extractProjTag(entry.tags);
  if (entryProj && entryProj !== currentProj) {
    score *= 0.35;
  } else if (entryProj && entryProj === currentProj) {
    score = Math.min(1, score + 0.05);
  }

  if (isGenericQuery(query) && reqSim < 0.4) {
    score = Math.min(score, 0.65);
  }

  // Context pages outrank entity pages in UI prior-hit search.
  if (entry.type === 'entity') {
    score = Math.max(0, score - 0.08);
  }

  return score;
}

function pickBestMatch(
  entries: KnowledgeEntry[],
  query: string,
  threshold: number,
  options?: WikiSearchOptions,
): ProtocolWikiMatch | null {
  const pool = options?.excludeTurn
    ? filterPriorKnowledge(entries, options.excludeTurn)
    : entries;
  if (pool.length === 0) return null;

  const scored = pool
    .map((entry) => ({ entry, score: calculateRelevanceScore(query, entry) }))
    .filter((result) => result.score >= threshold)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;

  return {
    entry: best.entry,
    score: best.score,
    matchedKeywords: extractQueryTokens(query),
  };
}

export class DefaultWikiMatchService implements WikiMatchService {
  private knowledgeRepo: KnowledgeRepository;

  constructor(knowledgeRepo?: KnowledgeRepository) {
    this.knowledgeRepo = knowledgeRepo || new KnowledgeRepository();
  }

  async searchByQuery(
    query: string,
    threshold: number,
    options?: WikiSearchOptions,
  ): Promise<ProtocolWikiMatch | null> {
    if (!query || query.trim().length < 3) return null;
    const entries = this.knowledgeRepo.listMatchPoolSync();
    return pickBestMatch(entries, query, threshold, options);
  }

  searchByQuerySync(
    query: string,
    threshold = 0.3,
    options?: WikiSearchOptions,
  ): ProtocolWikiMatch | null {
    if (!query || query.trim().length < 3) return null;
    const entries = this.knowledgeRepo.listMatchPoolSync();
    return pickBestMatch(entries, query, threshold, options);
  }
}

export {
  calculateRelevanceScore,
  isGenericQuery,
  normalizeMatchText,
  requestSimilarity,
};
