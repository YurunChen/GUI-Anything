/**
 * Wiki Search Types
 */

export interface WikiEntry {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  timestamp?: number;
  source?: string;
  sessionId?: string;
}

export interface WikiMatch {
  entry: WikiEntry;
  score: number;
  matchedQuery: string;
}

export interface WikiExtractionResult {
  extracted: boolean;
  entryId?: string;
  reason?: string;
  timestamp?: number;
}

export interface WikiPersistMeta {
  sessionId: string;
  timestamp: number;
  status: 'pending' | 'saved' | 'failed';
  explorationId?: string;
}
