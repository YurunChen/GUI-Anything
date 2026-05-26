/**
 * Wiki retrieval — prior knowledge only; excludes artifacts from the current turn.
 *
 * Bundle `explorations[id].retrieval`: undefined = not scanned; null = no hit; object = hit.
 */

import type { Exploration } from '../../data/protocol/observer-protocol';
import type { WikiMatch } from '../../data/protocol/wiki-types';
import { WIKI_SEARCH_THRESHOLD } from '../../constants/flow-constants';
import type { KnowledgeEntry } from '../../data/wiki/knowledge-repository';
import type { ExplorationCardRecord } from '../../data/wiki/session-bundle-types';
import {
  retrievalSnapshotToWikiMatch,
  wikiMatchToRetrievalSnapshot,
} from '../../data/wiki/session-bundle-mappers';
import {
  type SessionBundleRepository,
} from '../../data/wiki/session-bundle-repository';
import { DefaultWikiMatchService } from './match-service';
import { createLogger } from '../../utils/logger';
import { getSessionBundleRepository } from '../session/session-bundle-service';

const log = createLogger('wiki');

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

export function isExplorationRetrievalResolved(
  record: ExplorationCardRecord | undefined,
): boolean {
  return record !== undefined && record.retrieval !== undefined;
}

function matchFromRetrievalRecord(
  record: ExplorationCardRecord | undefined,
): WikiMatch | null {
  if (!record?.retrieval) return null;
  return retrievalSnapshotToWikiMatch(record.retrieval);
}

/**
 * Live/replay: read bundle retrieval, else search (and persist when jsonlPath set).
 * Idempotent — safe to call from UI polling and before summary generation.
 */
export function ensureExplorationRetrieval(input: {
  sessionId: string;
  exploration: Exploration;
  jsonlPath: string;
  allowLiveSearch: boolean;
  bundleRepository?: SessionBundleRepository;
}): WikiMatch | null {
  if (!extractWikiSearchQuery(input.exploration)) return null;

  const repo = input.bundleRepository ?? getSessionBundleRepository();
  const record = repo.load(input.sessionId)?.explorations[input.exploration.id];

  if (isExplorationRetrievalResolved(record)) {
    return matchFromRetrievalRecord(record);
  }
  if (!input.allowLiveSearch) return null;

  const match = findPriorKnowledgeForExploration(input.exploration, input.sessionId);
  if (!input.jsonlPath.trim()) return match;

  repo.patchExploration(
    input.sessionId,
    input.exploration.id,
    {
      question: input.exploration.question,
      retrieval: match ? wikiMatchToRetrievalSnapshot(match) : null,
    },
    input.jsonlPath,
  );

  if (match) {
    log.info('KNOWLEDGE hit', {
      sessionId: input.sessionId,
      explorationId: input.exploration.id,
      entryId: match.entry.id,
      score: match.score,
    });
  } else {
    log.debug('KNOWLEDGE no hit', {
      sessionId: input.sessionId,
      explorationId: input.exploration.id,
    });
  }
  return match;
}
