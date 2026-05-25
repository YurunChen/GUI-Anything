/**
 * Wiki turn UI — KNOWLEDGE card visibility; per-exploration write badge on ExplorationCard meta row.
 */

import type { Exploration, WikiMatch } from '../../../data/protocol/observer-protocol';
import { extractWikiSearchQuery } from '../../../services/wiki/wiki-retrieval-policy';
import type { CardDisplayMode } from './exploration-card-view';

export interface WikiTurnUiInput {
  exploration: Exploration;
  displayMode: CardDisplayMode;
  wikiMatch?: WikiMatch | null;
}

export function resolveWikiTurnUi(input: WikiTurnUiInput): { showKnowledgeCard: boolean } {
  const searchable = extractWikiSearchQuery(input.exploration) !== null;
  const status = input.exploration.status;
  // Prior match is pinned at question time (running+); not refreshed after wiki persist.
  const showKnowledgeCard = input.displayMode === 'expanded'
    && Boolean(input.wikiMatch)
    && searchable
    && (status === 'running' || status === 'complete' || status === 'interrupted');

  return { showKnowledgeCard };
}

export function shouldShowKnowledgeCard(
  displayMode: CardDisplayMode,
  exploration: Exploration,
  wikiMatch?: WikiMatch | null,
): boolean {
  return resolveWikiTurnUi({ exploration, displayMode, wikiMatch }).showKnowledgeCard;
}
