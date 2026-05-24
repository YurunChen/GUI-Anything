import type { WikiMatch as ProtocolWikiMatch } from '../../data/protocol/wiki-types';
import {
  KnowledgeRepository,
  type KnowledgeEntry,
} from '../../data/wiki/knowledge-repository';

export interface WikiMatchService {
  searchByQuery(query: string, threshold: number): Promise<ProtocolWikiMatch | null>;
  searchByQuerySync(query: string, threshold?: number): ProtocolWikiMatch | null;
}

function calculateRelevanceScore(query: string, entry: KnowledgeEntry): number {
  const queryLower = query.toLowerCase();
  const spaceWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  const allWords = [...new Set([
    ...spaceWords,
    ...queryLower.match(/[a-z]{3,}/g) || [],
    ...queryLower.match(/[\u4e00-\u9fa5]{2,}/g) || [],
  ])];

  if (allWords.length === 0) return 0;

  const requestLower = entry.request.toLowerCase();
  const contentLower = entry.content.toLowerCase();
  const tagsLower = (entry.tags || []).map((t) => t.toLowerCase()).join(' ');

  let matches = 0;
  let titleMatches = 0;

  for (const word of allWords) {
    if (requestLower.includes(word)) {
      titleMatches++;
      matches++;
    } else if (contentLower.includes(word)) {
      matches++;
    } else if (tagsLower.includes(word)) {
      matches++;
    }
  }

  const baseScore = matches / allWords.length;
  const titleBoost = titleMatches > 0 ? 0.2 : 0;
  return Math.min(1.0, baseScore + titleBoost);
}

function pickBestMatch(
  entries: KnowledgeEntry[],
  query: string,
  threshold: number,
): ProtocolWikiMatch | null {
  if (entries.length === 0) return null;

  const scored = entries
    .map((entry) => ({ entry, score: calculateRelevanceScore(query, entry) }))
    .filter((result) => result.score >= threshold)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;

  return {
    entry: best.entry,
    score: best.score,
    matchedKeywords: [query],
  };
}

export class DefaultWikiMatchService implements WikiMatchService {
  private knowledgeRepo: KnowledgeRepository;

  constructor(knowledgeRepo?: KnowledgeRepository) {
    this.knowledgeRepo = knowledgeRepo || new KnowledgeRepository();
  }

  async searchByQuery(query: string, threshold: number): Promise<ProtocolWikiMatch | null> {
    if (!query || query.trim().length < 3) return null;
    const entries = await this.knowledgeRepo.listAll();
    return pickBestMatch(entries, query, threshold);
  }

  searchByQuerySync(query: string, threshold = 0.3): ProtocolWikiMatch | null {
    if (!query || query.trim().length < 3) return null;
    const entries = this.knowledgeRepo.listAllSync();
    return pickBestMatch(entries, query, threshold);
  }
}
