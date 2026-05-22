/**
 * Wiki-related protocol types (data layer only — no service imports).
 */

import type { KnowledgeEntry } from '../wiki/knowledge-repository';

export type WikiPersistType = 'error' | 'snippet' | 'decision' | 'context' | 'none';

export interface WikiPersistMeta {
  should_persist: boolean;
  type: WikiPersistType;
  confidence: number;
  reason?: string;
  solution_detail?: string;
  tags?: string[];
  key_command?: string | null;
}

export interface WikiExtractionResult {
  id: string;
  slug: string;
  request: string;
  type: 'error' | 'snippet' | 'decision' | 'context';
  problem?: string;
  solution?: string;
  command?: string;
  confidence: number;
  content: string;
  sessionId?: string;
  explorationId?: string;
  evidenceContent?: string;
}

export interface ExplorationSummary {
  id: string;
  request?: string;
  summary: string;
  commands: string[];
  files: string[];
  nodes?: Array<{
    timestamp: number;
    type: string;
    label: string;
    status?: string;
    phase?: string;
    rawCommand?: string;
  }>;
  result: 'success' | 'failure' | 'abandoned';
  duration: number;
  tokens: number;
  sessionId?: string;
  persistMeta?: WikiPersistMeta | null;
}

export interface WikiMatch {
  entry: KnowledgeEntry;
  score: number;
  matchedKeywords: string[];
}
