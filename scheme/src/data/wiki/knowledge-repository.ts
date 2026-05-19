/**
 * Knowledge Repository - File-based knowledge storage
 *
 * Stores knowledge entries as JSON files in ~/.flow-wiki/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  timestamp: number;
  source?: string;  // Optional: where this knowledge came from
  sessionId?: string;  // Optional: which session created it
}

export interface KnowledgeRepository {
  add(entry: KnowledgeEntry): Promise<void>;
  get(id: string): Promise<KnowledgeEntry | null>;
  search(query: string): Promise<KnowledgeEntry[]>;
  list(): Promise<KnowledgeEntry[]>;
  delete(id: string): Promise<void>;
}

export class DefaultKnowledgeRepository implements KnowledgeRepository {
  private wikiDir: string;

  constructor(wikiDir?: string) {
    // Default to ~/.flow-wiki/
    this.wikiDir = wikiDir || path.join(os.homedir(), '.flow-wiki');
    this.ensureWikiDir();
  }

  private ensureWikiDir(): void {
    if (!fs.existsSync(this.wikiDir)) {
      fs.mkdirSync(this.wikiDir, { recursive: true });
    }
  }

  private getEntryPath(id: string): string {
    // Sanitize id to be filesystem-safe
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.wikiDir, `${safeId}.json`);
  }

  async add(entry: KnowledgeEntry): Promise<void> {
    const entryPath = this.getEntryPath(entry.id);
    const data = JSON.stringify(entry, null, 2);

    await fs.promises.writeFile(entryPath, data, 'utf-8');
  }

  async get(id: string): Promise<KnowledgeEntry | null> {
    const entryPath = this.getEntryPath(id);

    try {
      const data = await fs.promises.readFile(entryPath, 'utf-8');
      return JSON.parse(data) as KnowledgeEntry;
    } catch (error) {
      // File doesn't exist or parse error
      return null;
    }
  }

  async search(query: string): Promise<KnowledgeEntry[]> {
    const allEntries = await this.list();

    if (!query || query.trim() === '') {
      return allEntries;
    }

    const queryLower = query.toLowerCase();

    // Simple text matching: search in title, content, and tags
    return allEntries.filter(entry => {
      const titleMatch = entry.title.toLowerCase().includes(queryLower);
      const contentMatch = entry.content.toLowerCase().includes(queryLower);
      const tagMatch = entry.tags?.some(tag => tag.toLowerCase().includes(queryLower)) ?? false;

      return titleMatch || contentMatch || tagMatch;
    });
  }

  async list(): Promise<KnowledgeEntry[]> {
    try {
      const files = await fs.promises.readdir(this.wikiDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const entries: KnowledgeEntry[] = [];

      for (const file of jsonFiles) {
        const filePath = path.join(this.wikiDir, file);
        try {
          const data = await fs.promises.readFile(filePath, 'utf-8');
          const entry = JSON.parse(data) as KnowledgeEntry;
          entries.push(entry);
        } catch (error) {
          // Skip invalid files
          console.warn(`Failed to parse wiki entry: ${file}`, error);
        }
      }

      // Sort by timestamp (newest first)
      return entries.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      // Directory doesn't exist or read error
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    const entryPath = this.getEntryPath(id);

    try {
      await fs.promises.unlink(entryPath);
    } catch (error) {
      // File doesn't exist - ignore
    }
  }
}

// Export default instance as KnowledgeRepository for compatibility
export const KnowledgeRepository = DefaultKnowledgeRepository;
