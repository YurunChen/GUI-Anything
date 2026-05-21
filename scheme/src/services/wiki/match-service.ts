/**
 * Wiki Match Service - Knowledge matching and search
 *
 * Matches user queries against the knowledge repository
 */

import type { WikiMatch } from '../../data/services/wiki/search';
import { DefaultKnowledgeRepository, type KnowledgeEntry } from '../../data/wiki/knowledge-repository';

export interface WikiMatchService {
  match(query: string): Promise<string[]>;
  searchByQuery(query: string, threshold?: number): Promise<WikiMatch | null>;
  searchByQuerySync(query: string, threshold?: number): WikiMatch | null;
}

export class DefaultWikiMatchService implements WikiMatchService {
  private repository: DefaultKnowledgeRepository;

  constructor() {
    this.repository = new DefaultKnowledgeRepository();
  }

  async match(query: string): Promise<string[]> {
    const results = await this.repository.search(query);
    return results.map(entry => entry.id);
  }

  async searchByQuery(query: string, threshold: number = 0.3): Promise<WikiMatch | null> {
    if (!query || query.trim() === '') {
      return null;
    }

    // Get all entries (don't use repository.search which requires exact phrase match)
    const allEntries = await this.repository.list();

    if (allEntries.length === 0) {
      return null;
    }

    // Calculate simple relevance score based on keyword matches
    const scoredResults = allEntries.map(entry => ({
      entry,
      score: this.calculateRelevanceScore(query, entry),
    }));

    // Filter by threshold
    const filtered = scoredResults.filter(result => result.score >= threshold);

    if (filtered.length === 0) {
      return null;
    }

    // Sort by score (descending) and return best match
    filtered.sort((a, b) => b.score - a.score);

    const best = filtered[0];
    return {
      entry: {
        id: best.entry.id,
        title: best.entry.title,
        content: best.entry.content,
        tags: best.entry.tags,
      },
      score: best.score,
      matchedQuery: query,
    };
  }

  searchByQuerySync(query: string, threshold: number = 0.3): WikiMatch | null {
    if (!query || query.trim() === '') {
      return null;
    }

    // Get all entries synchronously
    const allEntries = this.repository.listSync();

    if (allEntries.length === 0) {
      return null;
    }

    // Calculate simple relevance score based on keyword matches
    const scoredResults = allEntries.map(entry => ({
      entry,
      score: this.calculateRelevanceScore(query, entry),
    }));

    // Filter by threshold
    const filtered = scoredResults.filter(result => result.score >= threshold);

    if (filtered.length === 0) {
      return null;
    }

    // Sort by score (descending) and return best match
    filtered.sort((a, b) => b.score - a.score);

    const best = filtered[0];
    return {
      entry: {
        id: best.entry.id,
        title: best.entry.title,
        content: best.entry.content,
        tags: best.entry.tags,
      },
      score: best.score,
      matchedQuery: query,
    };
  }

  /**
   * Calculate relevance score (0.0 - 1.0)
   * Simple algorithm: count keyword matches in title/content/tags
   * Supports both English (space-separated) and Chinese/mixed queries
   */
  private calculateRelevanceScore(query: string, entry: KnowledgeEntry): number {
    // Extract meaningful words from query
    // For English: split by space and filter short words
    // For Chinese/mixed: also extract sequences of 2+ chars
    const queryLower = query.toLowerCase();

    // Split by space
    const spaceWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Also extract all sequences of 2+ alphanumeric chars (for Chinese/English mix)
    const allWords = [...new Set([
      ...spaceWords,
      ...queryLower.match(/[a-z]{3,}/g) || [],  // English words
      ...queryLower.match(/[\u4e00-\u9fa5]{2,}/g) || [],  // Chinese phrases
    ])];

    if (allWords.length === 0) {
      return 0;
    }

    const titleLower = entry.title.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    const tagsLower = (entry.tags || []).map(t => t.toLowerCase()).join(' ');

    let matches = 0;
    let titleMatches = 0;

    for (const word of allWords) {
      // Title matches count more
      if (titleLower.includes(word)) {
        titleMatches++;
        matches++;
      } else if (contentLower.includes(word)) {
        matches++;
      } else if (tagsLower.includes(word)) {
        matches++;
      }
    }

    // Score = (matches / total words) with title boost
    const baseScore = matches / allWords.length;
    const titleBoost = titleMatches > 0 ? 0.2 : 0;

    return Math.min(1.0, baseScore + titleBoost);
  }
}
