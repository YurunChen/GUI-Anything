/**
 * WikiMatchCard — prior knowledge hit: meta row, excerpt body, tags.
 */

import type { ReactNode } from 'react';
import type { WikiMatch } from '../../../data/protocol/observer-protocol';
import { semantic } from '../theme';
import { formatFlowText, truncateFlowText } from '../../../utils/flow-text';
import { getObserverMessages } from '../i18n/observer-messages';
import { FlowLineGap } from './flow-ui/FlowInsetGroup';
import { FlowTagRow } from './flow-ui/FlowTagRow';
import { formatKnowledgeExcerpt } from '../../../services/wiki/wiki-text-utils';

interface WikiMatchCardProps {
  match: WikiMatch;
  availableWidth: number;
  contextQuestion?: string;
  inset?: boolean;
}

export function WikiMatchCard({
  match,
  availableWidth,
  contextQuestion,
}: WikiMatchCardProps): ReactNode {
  const messages = getObserverMessages();
  const excerpt = formatKnowledgeExcerpt(match.entry.content, 240, messages);
  const showRequest = shouldShowRequest(match.entry.request, contextQuestion);
  const displayTags = (match.entry.tags || []).filter((t) => !t.startsWith('proj:'));
  const typeLabel = formatKnowledgeTypeLabel(match.entry.type, messages.wikiKnowledgeType);
  const slugLine = formatSlugForDisplay(match.entry.slug, availableWidth);

  const continuityLine = formatWikiContinuityLine(match, messages);

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      <text wrapMode="char" fg={semantic.wiki.matchColor}>
        {continuityLine}
      </text>
      <text>
        <span fg={semantic.label.quaternary}>{typeLabel}</span>
      </text>
      {slugLine ? (
        <text fg={semantic.label.quaternary} wrapMode="char">
          {slugLine}
        </text>
      ) : null}
      {match.entry.relativePath ? (
        <text fg={semantic.label.quaternary} wrapMode="char">
          {truncateFlowText(match.entry.relativePath, Math.max(32, availableWidth - 2))}
        </text>
      ) : null}
      {showRequest ? (
        <>
          <FlowLineGap />
          <text wrapMode="char" fg={semantic.label.tertiary}>
            {formatFlowText(match.entry.request)}
          </text>
        </>
      ) : null}
      <FlowLineGap />
      <text wrapMode="char" fg={semantic.label.secondary}>
        {excerpt}
      </text>
      {displayTags.length > 0 ? (
        <>
          <FlowLineGap />
          <FlowTagRow tags={displayTags} variant="wiki" />
        </>
      ) : null}
    </box>
  );
}

export function formatWikiContinuityLine(
  match: WikiMatch,
  messages: ReturnType<typeof getObserverMessages>,
): string {
  const title = continuityTitleFromMatch(match, messages);
  const score = Math.round(match.score * 100);
  return messages.wikiContinuity(match.entry.id, title, score);
}

function continuityTitleFromMatch(
  match: WikiMatch,
  messages: ReturnType<typeof getObserverMessages>,
): string {
  const excerpt = formatKnowledgeExcerpt(match.entry.content, 40, messages);
  const empty = messages.wikiExcerptEmpty;
  if (excerpt && excerpt !== empty) return excerpt;
  const slug = (match.entry.slug || match.entry.id).replace(/-/g, ' ');
  return formatSlugForDisplay(slug, 32) || match.entry.id;
}

export function formatKnowledgeTypeLabel(
  type: string,
  labels: Record<string, string>,
): string {
  return labels[type] ?? type;
}

export function formatSlugForDisplay(slug: string, availableWidth: number): string {
  const trimmed = slug.trim();
  if (!trimmed) return '';
  const budget = Math.max(28, Math.min(64, availableWidth - 2));
  return truncateFlowText(trimmed, budget);
}

export function shouldShowRequest(request: string, contextQuestion?: string): boolean {
  if (!request.trim()) return false;
  if (!contextQuestion?.trim()) return true;
  return formatFlowText(request) !== formatFlowText(contextQuestion);
}

