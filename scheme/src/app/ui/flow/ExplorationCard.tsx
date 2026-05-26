/**
 * ExplorationCard — question · meta · prior KNOWLEDGE (retrieval) · Summary.
 */

import type { ReactNode } from 'react';
import { memo } from 'react';
import { semantic, useThemeVersion } from '../theme';
import type {
  Exploration,
  ExplorationNode,
  PersistResult,
  SummaryItem,
  WikiMatch,
} from '../../../data/protocol/observer-protocol';
import { formatWikiPersistBadge } from './StatusBadges';
import {
  resolveSummaryDisplayTier,
  type SummaryDisplayTier,
} from '../../observer/view-model/presentation-summaries';
import { resolveWikiTurnUi } from '../../observer/view-model/wiki-turn-chrome';
import {
  buildCompactLine,
  buildLiveFootnote,
  resolveCardDisplayMode,
  shouldShowInlineSummary,
  type CardDisplayMode,
} from '../../observer/view-model/exploration-card-view';
import { FlowInsetGroup, FlowSection, FlowFramedSection } from './flow-ui/FlowInsetGroup';
import { FlowMetaRow } from './flow-ui/FlowMetaRow';
import { WikiMatchCard } from './WikiMatchCard';
import { formatFlowText, truncateFlowText } from '../../../utils/flow-text';
import { getObserverMessages } from '../i18n/observer-messages';

interface ExplorationCardProps {
  exploration: Exploration;
  calmMode: boolean;
  /** Latest turn in the timeline; in calm mode only this card shows full summary. */
  isLatestExploration?: boolean;
  spinnerFrame: string;
  summary?: string;
  summaryItem?: SummaryItem;
  isGenerating: boolean;
  availableWidth: number;
  wikiMatch?: WikiMatch;
  wikiPersistStatus?: 'saved' | 'updated' | 'skipped' | 'failed' | 'pending';
  wikiPersistResult?: PersistResult;
  wikiTargetId?: string;
  wikiTurnCount?: number;
}

export const ExplorationCard = memo(function ExplorationCard(props: ExplorationCardProps): ReactNode {
  useThemeVersion();

  const {
    exploration,
    calmMode,
    isLatestExploration = false,
    spinnerFrame,
    summary,
    summaryItem,
    isGenerating,
    availableWidth,
    wikiMatch,
    wikiPersistStatus,
    wikiPersistResult,
    wikiTargetId,
    wikiTurnCount,
  } = props;

  const showWikiPersist = Boolean(
    wikiPersistStatus
    && (exploration.status === 'complete' || exploration.status === 'interrupted'),
  );
  const wikiPersistLabel = showWikiPersist
    ? formatWikiPersistBadge(wikiPersistStatus!, wikiPersistResult?.reason, {
      targetId: wikiTargetId,
      turnCount: wikiTurnCount,
    }).text
    : undefined;

  const toolNodes = exploration.nodes.filter((node: ExplorationNode) => node.type === 'tool');
  const errorNodes = exploration.nodes.filter(
    (node: ExplorationNode) => node.status === 'error' || node.type === 'error',
  );

  const toolCounts = new Map<string, number>();
  for (const node of toolNodes) {
    const toolName = node.label.split(' ')[0] || 'unknown';
    toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
  }
  const toolSummary = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${truncateFlowText(name, 14)}×${count}`)
    .join(' · ');

  const displayMode: CardDisplayMode = resolveCardDisplayMode({ calmMode, isLatestExploration });
  const accentRunning = exploration.status === 'running';
  const messages = getObserverMessages();
  const questionText = formatFlowText(exploration.question) || 'N/A';
  const liveFootnote = buildLiveFootnote({
    status: exploration.status,
    spinnerFrame,
    toolCount: toolNodes.length,
    errorCount: errorNodes.length,
    toolSummary: toolSummary || undefined,
    isGenerating,
  });
  const showInlineSummary = shouldShowInlineSummary(displayMode, exploration.status, isGenerating);
  const { showKnowledgeCard } = resolveWikiTurnUi({
    exploration,
    displayMode,
    wikiMatch,
  });
  const summaryTier = !isGenerating ? resolveSummaryDisplayTier(summaryItem) : null;
  const summaryTierLabel = formatSummaryTierLabel(summaryTier, messages);

  const summarySection = showInlineSummary ? (
    <FlowSection
      label={messages.summary}
      labelSuffix={!isGenerating ? summaryTierLabel : undefined}
    >
      {isGenerating ? (
        <text wrapMode="none" fg={semantic.activity}>
          {`${spinnerFrame} ${messages.summarizing}`}
        </text>
      ) : (
        <text wrapMode="char" fg={semantic.label.secondary}>
          {buildInlineSummary(summary, false)}
        </text>
      )}
    </FlowSection>
  ) : null;

  const knowledgeSection = showKnowledgeCard && wikiMatch ? (
    <FlowFramedSection
      label={`${messages.knowledge} · ${wikiMatch.entry.id}`}
      variant="knowledge"
    >
      <WikiMatchCard
        match={wikiMatch}
        contextQuestion={exploration.question}
      />
    </FlowFramedSection>
  ) : null;

  if (displayMode === 'compact') {
    const compactLine = buildCompactLine({
      question: exploration.question,
      status: exploration.status,
      spinnerFrame,
      toolCount: toolNodes.length,
      isGenerating,
      wikiPersistLabel,
    });

    return (
      <FlowInsetGroup accent={accentRunning}>
        <text wrapMode="word" fg={semantic.label.secondary}>
          {compactLine}
        </text>
        {summarySection}
      </FlowInsetGroup>
    );
  }

  return (
    <FlowInsetGroup accent={accentRunning}>
      <text wrapMode="word">
        <span fg={semantic.label.secondary}>{questionText}</span>
      </text>

      <FlowMetaRow
        statusBadge={liveFootnote.statusBadge}
        statusTone={liveFootnote.statusTone}
        toolCount={liveFootnote.toolCount}
        errorCount={liveFootnote.errorCount}
        toolSummary={liveFootnote.toolSummary}
        wikiPersistStatus={showWikiPersist ? wikiPersistStatus : undefined}
        wikiPersistResult={wikiPersistResult}
        wikiTargetId={wikiTargetId}
        wikiTurnCount={wikiTurnCount}
      />

      {knowledgeSection}
      {summarySection}
    </FlowInsetGroup>
  );
});

function formatSummaryTierLabel(
  tier: SummaryDisplayTier | null,
  messages: ReturnType<typeof getObserverMessages>,
): string | undefined {
  if (!tier) return undefined;
  switch (tier) {
    case 'cache':
      return messages.summaryTierCache;
    case 'fallback':
      return messages.summaryTierFallback;
    default:
      return undefined;
  }
}

function buildInlineSummary(summary: string | undefined, isGenerating: boolean): string {
  if (!summary || !summary.trim()) {
    return isGenerating ? 'Generating summary…' : 'No summary';
  }
  return formatFlowText(summary);
}
