/**
 * WikiMatchCard — prior knowledge hit: excerpt body and tags.
 */

import type { ReactNode } from 'react';
import type { WikiMatch } from '../../../data/protocol/observer-protocol';
import { useTuiTheme } from '../theme';
import { formatFlowText } from '../../../utils/flow-text';
import { formatKnowledgeExcerpt } from '../../../utils/wiki-text';
import { getObserverMessages } from '../i18n/observer-messages';
import { FlowLineGap } from './flow-ui/FlowInsetGroup';
import { FlowTagRow } from './flow-ui/FlowTagRow';

interface WikiMatchCardProps {
  match: WikiMatch;
  contextQuestion?: string;
}

export function WikiMatchCard({
  match,
  contextQuestion,
}: WikiMatchCardProps): ReactNode {
  const wikiTheme = useTuiTheme().modes.wiki;
  const messages = getObserverMessages();
  const excerpt = formatKnowledgeExcerpt(match.entry.content, 240, messages);
  const showRequest = shouldShowRequest(match.entry.request, contextQuestion);
  const displayTags = (match.entry.tags || []).filter((t) => !t.startsWith('proj:'));

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {showRequest ? (
        <text wrapMode="char" fg={wikiTheme.requestFg}>
          {formatFlowText(match.entry.request)}
        </text>
      ) : null}
      {showRequest ? <FlowLineGap /> : null}
      <text wrapMode="char" fg={wikiTheme.excerptFg}>
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

export function shouldShowRequest(request: string, contextQuestion?: string): boolean {
  if (!request.trim()) return false;
  if (!contextQuestion?.trim()) return true;
  return formatFlowText(request) !== formatFlowText(contextQuestion);
}
