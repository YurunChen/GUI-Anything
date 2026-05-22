import type { WikiMatch as ProtocolWikiMatch } from '../../data/protocol/wiki-types';
import {
  KnowledgeRepository,
  type KnowledgeEntry,
} from '../../data/wiki/knowledge-repository';

export interface WikiMatchService {
  searchByQuery(query: string, threshold: number): Promise<ProtocolWikiMatch | null>;
}

// 简单关键词相似度计算
function calculateScore(entry: KnowledgeEntry, query: string): number {
  const queryLower = query.toLowerCase();
  let score = 0;
  
  // 标题匹配
  if (entry.request.toLowerCase().includes(queryLower)) score += 10;
  
  // 内容匹配
  if (entry.content.toLowerCase().includes(queryLower)) score += 5;
  
  // 标签匹配
  for (const tag of entry.tags) {
    if (tag.toLowerCase().includes(queryLower)) score += 3;
  }
  
  return score / 20; // 归一化
}

export class DefaultWikiMatchService implements WikiMatchService {
  private knowledgeRepo: KnowledgeRepository;

  constructor(knowledgeRepo?: KnowledgeRepository) {
    this.knowledgeRepo = knowledgeRepo || new KnowledgeRepository();
  }

  async searchByQuery(query: string, threshold: number): Promise<ProtocolWikiMatch | null> {
    if (!query || query.trim().length < 3) return null;
    
    const entries = await this.knowledgeRepo.listAll();
    if (entries.length === 0) return null;
    
    let bestMatch: { entry: KnowledgeEntry; score: number } | null = null;
    
    for (const entry of entries) {
      const score = calculateScore(entry, query);
      if (score > (bestMatch?.score ?? 0)) {
        bestMatch = { entry, score };
      }
    }
    
    if (bestMatch && bestMatch.score >= threshold) {
      return {
        entry: bestMatch.entry,
        score: bestMatch.score,
        matchedKeywords: [query],
      };
    }
    
    return null;
  }
}
