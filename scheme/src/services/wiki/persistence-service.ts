/**
 * Wiki Persistence Service - Session-based wiki persistence
 *
 * Manages inspiration notes and exploration persistence per session
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { InspirationRecord } from './auto-extractor';

export interface WikiPersistenceService {
  save(record: InspirationRecord): Promise<void>;
  load(): Promise<InspirationRecord[]>;
  delete(id: string): Promise<void>;
  resetSession(sessionId: string): void;
  hydratePersisted(sessionId: string): Promise<Record<string, any>>;
  persistExploration(id: string, data: any): Promise<void>;
}

export class DefaultWikiPersistenceService implements WikiPersistenceService {
  private sessionDir: string;
  private currentSessionId: string = '';
  private sessionCache: Map<string, any> = new Map();

  constructor(sessionDir?: string) {
    // Default to ~/.flow-sessions/
    this.sessionDir = sessionDir || path.join(os.homedir(), '.flow-sessions');
    this.ensureSessionDir();
  }

  private ensureSessionDir(): void {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  private getSessionPath(sessionId: string): string {
    if (!sessionId) return '';
    return path.join(this.sessionDir, `${sessionId}.json`);
  }

  private getInspirationPath(): string {
    return path.join(this.sessionDir, 'inspirations.json');
  }

  resetSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.sessionCache.clear();
  }

  async hydratePersisted(sessionId: string): Promise<Record<string, any>> {
    const sessionPath = this.getSessionPath(sessionId);

    if (!sessionPath || !fs.existsSync(sessionPath)) {
      return {};
    }

    try {
      const data = await fs.promises.readFile(sessionPath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.explorations || {};
    } catch (error) {
      console.warn(`Failed to hydrate session ${sessionId}:`, error);
      return {};
    }
  }

  async persistExploration(id: string, data: any): Promise<void> {
    if (!this.currentSessionId) {
      return; // No active session
    }

    this.sessionCache.set(id, data);

    const sessionPath = this.getSessionPath(this.currentSessionId);
    if (!sessionPath) return;

    // Load existing data
    let sessionData: any = { explorations: {} };

    if (fs.existsSync(sessionPath)) {
      try {
        const existing = await fs.promises.readFile(sessionPath, 'utf-8');
        sessionData = JSON.parse(existing);
      } catch (error) {
        // Ignore parse errors
      }
    }

    // Update exploration
    sessionData.explorations = sessionData.explorations || {};
    sessionData.explorations[id] = {
      ...data,
      persistedAt: Date.now(),
    };

    // Save back
    await fs.promises.writeFile(
      sessionPath,
      JSON.stringify(sessionData, null, 2),
      'utf-8'
    );
  }

  async save(record: InspirationRecord): Promise<void> {
    const inspirationPath = this.getInspirationPath();

    // Load existing inspirations
    let inspirations: InspirationRecord[] = [];

    if (fs.existsSync(inspirationPath)) {
      try {
        const data = await fs.promises.readFile(inspirationPath, 'utf-8');
        inspirations = JSON.parse(data);
      } catch (error) {
        // Ignore parse errors
      }
    }

    // Add new record
    inspirations.unshift(record); // Add to beginning (newest first)

    // Keep only last 100 records
    if (inspirations.length > 100) {
      inspirations = inspirations.slice(0, 100);
    }

    // Save back
    await fs.promises.writeFile(
      inspirationPath,
      JSON.stringify(inspirations, null, 2),
      'utf-8'
    );
  }

  async load(): Promise<InspirationRecord[]> {
    const inspirationPath = this.getInspirationPath();

    if (!fs.existsSync(inspirationPath)) {
      return [];
    }

    try {
      const data = await fs.promises.readFile(inspirationPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load inspirations:', error);
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    const inspirationPath = this.getInspirationPath();

    if (!fs.existsSync(inspirationPath)) {
      return;
    }

    try {
      const data = await fs.promises.readFile(inspirationPath, 'utf-8');
      let inspirations: InspirationRecord[] = JSON.parse(data);

      // Filter out the record
      inspirations = inspirations.filter(record => record.id !== id);

      // Save back
      await fs.promises.writeFile(
        inspirationPath,
        JSON.stringify(inspirations, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.warn('Failed to delete inspiration:', error);
    }
  }
}
