/**
 * Wiki retrieval — prior knowledge only; excludes artifacts from the current turn.
 */

import type { Exploration } from '../../data/protocol/observer-protocol';
import type { WikiMatch } from '../../data/protocol/wiki-types';
import { WIKI_SEARCH_THRESHOLD } from '../../constants/flow-constants';
import type { KnowledgeEntry } from '../../data/wiki/knowledge-repository';
import { DefaultWikiMatchService } from './match-service';

export interface WikiRetrievalTurn {
  sessionId: string;
  explorationId: string;
}

export function extractWikiSearchQuery(exploration: Exploration | undefined): string | null {
  if (!exploration) return null;

  let query = exploration.question;
  if (!query || query.trim() === '') {
    const textNodes = exploration.nodes?.filter((n) =>
      n.rawText && n.rawText.length > 10
      && (n.type === 'response' || !n.type),
    ) || [];
    if (textNodes.length > 0) {
      query = textNodes[0].rawText || '';
    }
  }

  if (!query || query.length < 5) return null;
  return query;
}

/** Same scoring as UI KNOWLEDGE card — uses exploration.question (running+), not summary. */
export function findPriorKnowledgeForExploration(
  exploration: Exploration,
  sessionId: string,
  threshold: number = WIKI_SEARCH_THRESHOLD,
  service = new DefaultWikiMatchService(),
): WikiMatch | null {
  if (!sessionId.trim()) return null;
  const query = extractWikiSearchQuery(exploration);
  if (!query) return null;

  try {
    return service.searchByQuerySync(query, threshold, {
      excludeTurn: { sessionId, explorationId: exploration.id },
    });
  } catch {
    return null;
  }
}

export function isSameTurnKnowledge(
  entry: KnowledgeEntry,
  turn: WikiRetrievalTurn,
): boolean {
  return entry.sessionId === turn.sessionId && entry.explorationId === turn.explorationId;
}

export function filterPriorKnowledge(
  entries: KnowledgeEntry[],
  turn: WikiRetrievalTurn,
): KnowledgeEntry[] {
  return entries.filter((entry) => !isSameTurnKnowledge(entry, turn));
}
