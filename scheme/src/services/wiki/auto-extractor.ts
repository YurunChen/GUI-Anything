/**
 * Wiki Auto Extractor - Automatic knowledge extraction
 *
 * Extracts valuable knowledge from Flow events using pattern matching
 * and optional AI analysis
 */

import { DefaultKnowledgeRepository, type KnowledgeEntry } from '../../data/wiki/knowledge-repository';
import { DefaultWikiPersistenceService } from './persistence-service';

export interface InspirationRecord {
  id: string;
  content: string;
  timestamp: number;
  source?: string;
  sessionId?: string;
  tags?: string[];
}

export interface WikiAutoExtractor {
  extract(content: string, context?: ExtractionContext): Promise<InspirationRecord | null>;
}

export interface ExtractionContext {
  sessionId?: string;
  toolName?: string;
  isError?: boolean;
}

export class DefaultWikiAutoExtractor implements WikiAutoExtractor {
  private repository: DefaultKnowledgeRepository;
  private persistenceService: DefaultWikiPersistenceService;

  // Patterns that indicate valuable knowledge
  private knowledgePatterns = [
    /(?:learned|discovered|realized|found out|figured out|solved)/i,
    /(?:important|crucial|critical|key|essential|must remember)/i,
    /(?:bug|issue|problem|error|fix|solution|workaround)/i,
    /(?:tip|trick|best practice|gotcha|caveat|pitfall)/i,
    /(?:pattern|approach|strategy|technique|method)/i,
  ];

  constructor() {
    this.repository = new DefaultKnowledgeRepository();
    this.persistenceService = new DefaultWikiPersistenceService();
  }

  async extract(content: string, context?: ExtractionContext): Promise<InspirationRecord | null> {
    if (!content || content.trim().length < 20) {
      return null; // Too short to be valuable
    }

    // Check if content matches knowledge patterns
    const hasKnowledgeIndicator = this.knowledgePatterns.some(pattern =>
      pattern.test(content)
    );

    if (!hasKnowledgeIndicator) {
      return null; // Doesn't look like knowledge
    }

    // Extract key information
    const record: InspirationRecord = {
      id: this.generateId(),
      content: content.trim(),
      timestamp: Date.now(),
      source: context?.toolName || 'unknown',
      sessionId: context?.sessionId,
      tags: this.extractTags(content),
    };

    return record;
  }

  private generateId(): string {
    return `inspiration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];

    // Extract common technical terms as tags
    const techTerms = [
      'react', 'typescript', 'node', 'python', 'api', 'database',
      'error', 'bug', 'fix', 'performance', 'security', 'test',
      'git', 'docker', 'aws', 'authentication', 'config',
    ];

    const contentLower = content.toLowerCase();

    for (const term of techTerms) {
      if (contentLower.includes(term)) {
        tags.push(term);
      }
    }

    return tags;
  }

  /**
   * Save a valuable insight as a permanent knowledge entry
   */
  async saveAsKnowledge(record: InspirationRecord, title?: string): Promise<void> {
    const entry: KnowledgeEntry = {
      id: record.id,
      title: title || this.generateTitle(record.content),
      content: record.content,
      tags: record.tags,
      timestamp: record.timestamp,
      source: record.source,
      sessionId: record.sessionId,
    };

    await this.repository.add(entry);
  }

  private generateTitle(content: string): string {
    // Extract first sentence or first 60 chars
    const firstSentence = content.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      return firstSentence[0].trim();
    }

    return content.substring(0, 60) + (content.length > 60 ? '...' : '');
  }
}

// Shared instance
const extractorInstance = new DefaultWikiAutoExtractor();
const persistenceInstance = new DefaultWikiPersistenceService();

// Additional utility functions
export async function listRecentInspirationNotes(limit: number = 10): Promise<InspirationRecord[]> {
  const all = await persistenceInstance.load();
  return all.slice(0, limit);
}

export async function saveInspirationNote(record: InspirationRecord): Promise<void> {
  await persistenceInstance.save(record);
}

export async function deleteInspirationNote(id: string): Promise<void> {
  await persistenceInstance.delete(id);
}

export async function promoteInspirationToKnowledge(
  inspirationId: string,
  title?: string
): Promise<void> {
  const inspirations = await persistenceInstance.load();
  const inspiration = inspirations.find(i => i.id === inspirationId);

  if (!inspiration) {
    throw new Error(`Inspiration ${inspirationId} not found`);
  }

  await extractorInstance.saveAsKnowledge(inspiration, title);
}
