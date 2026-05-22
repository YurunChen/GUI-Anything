/**
 * Wiki Search Module
 * 使用 KnowledgeRepository 进行知识搜索
 */

import { KnowledgeRepository, getKnowledgeRepository, type KnowledgeEntry } from '../../data/wiki/knowledge-repository';
import type { WikiMatch } from '../../data/protocol/wiki-types';

export type { WikiMatch } from '../../data/protocol/wiki-types';

// 提取关键词 (简单的中文/英文分词)
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['怎么', '什么', '为什么', '如何', '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
  
  const words: string[] = [];
  
  // 英文单词
  const englishWords = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  words.push(...englishWords.filter(w => w.length > 2 && !stopWords.has(w)));
  
  // 中文词汇 (简单按长度提取)
  const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const chars of chineseChars) {
    for (let i = 0; i < chars.length - 1; i++) {
      for (let len = 2; len <= 4 && i + len <= chars.length; len++) {
        const word = chars.slice(i, i + len);
        if (!stopWords.has(word)) {
          words.push(word);
        }
      }
    }
  }
  
  return [...new Set(words)];
}

// 计算相似度分数
function calculateScore(entry: KnowledgeEntry, keywords: string[], query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  
  // 1. 标题匹配 (最高权重)
  const requestLower = entry.request.toLowerCase();
  for (const kw of keywords) {
    if (requestLower.includes(kw)) {
      score += 10;
      if (requestLower === kw) score += 5;
    }
  }
  
  // 2. 标签匹配
  for (const tag of entry.tags) {
    const tagLower = tag.toLowerCase();
    for (const kw of keywords) {
      if (tagLower.includes(kw)) {
        score += 6;
      }
    }
  }
  
  // 3. 全文内容匹配
  const contentLower = entry.content.toLowerCase();
  for (const kw of keywords) {
    if (contentLower.includes(kw)) {
      score += 2;
    }
  }
  
  // 4. ID 匹配 (精确匹配时高分)
  if (entry.id.toLowerCase() === queryLower) {
    score += 20;
  }
  
  // 归一化到 0-1 范围
  const normalizedScore = Math.min(score / 50, 1);
  
  return normalizedScore;
}

// 搜索 Wiki，返回最佳匹配
export async function searchWiki(
  query: string,
  threshold: number = 0.90
): Promise<WikiMatch | null> {
  if (!query || query.trim().length < 3) return null;
  
  const repo = getKnowledgeRepository();
  const entries = await repo.listAll();
  
  if (entries.length === 0) return null;
  
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return null;
  
  let bestMatch: WikiMatch | null = null;
  
  for (const entry of entries) {
    const score = calculateScore(entry, keywords, query);
    
    if (score > (bestMatch?.score ?? 0)) {
      bestMatch = {
        entry: { ...entry },
        score,
        matchedKeywords: keywords,
      };
    }
  }
  
  if (bestMatch && bestMatch.score >= threshold) {
    return bestMatch;
  }
  
  return null;
}

// 获取 Wiki 统计信息
export async function getWikiStats(): Promise<{ total: number; byType: Record<string, number> }> {
  const repo = getKnowledgeRepository();
  return repo.stats();
}

// 导出类型
export type { KnowledgeEntry };
export { KnowledgeRepository, getKnowledgeRepository };
