/**
 * ExplorationCard — question · meta · prior KNOWLEDGE (retrieval) · Summary.
 */

import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';
import { useThemeVersion, useTuiTheme } from '../theme';
import {
  resolveCompactSeparator,
  resolveKineticSpinner,
} from '../themes/theme-profile';
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
import { SUMMARY_REASON_LIVE_PREVIEW } from '../../../data/protocol/summary-provenance';
import { resolveWikiTurnUi } from '../../observer/view-model/wiki-turn-chrome';
import {
  buildCompactLine,
  buildLiveFootnote,
  buildTimelineCardHeader,
  resolveCardDisplayMode,
  resolveQuestionBody,
  shouldRenderTimelineSummary,
  type CardDisplayMode,
} from '../../observer/view-model/exploration-card-view';
import { FlowFramedSection, FlowInsetGroup, FlowLineGap } from './flow-ui/FlowInsetGroup';
import { FlowMetaRow } from './flow-ui/FlowMetaRow';
import { WikiMatchCard } from './WikiMatchCard';
import { formatFlowText, truncateFlowText } from '../../../utils/flow-text';
import { contentTextColumns } from './summary-layout';
import { getObserverMessages, resolveObserverLocale } from '../i18n/observer-messages';

interface ExplorationCardProps {
  exploration: Exploration;
  calmMode: boolean;
  /** Latest turn in the timeline; in calm mode only this card shows full summary. */
  isLatestExploration?: boolean;
  /** Summary just moved from loading to ready; used for a short reveal highlight. */
  isSummaryFresh?: boolean;
  spinnerFrame: string;
  motionFrame?: number;
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
    isSummaryFresh = false,
    spinnerFrame,
    motionFrame = 0,
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

  // Theme switches re-render every mounted card; cache the node-derived work so a
  // recolor doesn't re-scan exploration.nodes (cost scales with timeline length).
  const { toolNodes, errorNodes, toolSummary } = useMemo(() => {
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
    return { toolNodes, errorNodes, toolSummary };
  }, [exploration.nodes]);

  const displayMode: CardDisplayMode = resolveCardDisplayMode({ calmMode, isLatestExploration });
  const tuiTheme = useTuiTheme();
  const chrome = tuiTheme.chrome;
  const timelineTheme = tuiTheme.modes.timeline;
  const accentRunning = exploration.status === 'running';
  const spinnerAnimating = accentRunning || isGenerating;
  const kineticSpinner = resolveKineticSpinner(chrome, spinnerFrame, motionFrame, spinnerAnimating);
  const compactSeparator = resolveCompactSeparator(chrome, motionFrame);
  const messages = getObserverMessages();
  const locale = resolveObserverLocale();
  const questionColumns = contentTextColumns(availableWidth, 'timeline-body');
  const questionFitsPreview = !resolveQuestionBody({
    question: exploration.question,
    contentColumns: questionColumns,
  }).truncated;
  const questionBody = resolveQuestionBody({
    question: exploration.question,
    contentColumns: questionColumns,
  });
  const showQuestionPreview = isLatestExploration && !questionFitsPreview;
  const liveFootnote = buildLiveFootnote({
    status: exploration.status,
    spinnerFrame: kineticSpinner,
    toolCount: toolNodes.length,
    errorCount: errorNodes.length,
    toolSummary: toolSummary || undefined,
    isGenerating,
  });
  const showSummarySection = shouldRenderTimelineSummary({
    displayMode,
    status: exploration.status,
    isGenerating,
    summary,
  });
  const { showKnowledgeCard } = resolveWikiTurnUi({
    exploration,
    displayMode,
    wikiMatch,
  });
  const summaryTier = !isGenerating ? resolveSummaryDisplayTier(summaryItem) : null;
  const summaryTierLabel = formatSummaryTierLabel(summaryTier, messages);
  const summaryIsLivePreview = summaryItem?.reason === SUMMARY_REASON_LIVE_PREVIEW;
  const displaySummary = isGenerating && summaryIsLivePreview ? undefined : summary;
  const showSummaryLoading = isGenerating && !displaySummary?.trim();
  const cardHeader = buildTimelineCardHeader({
    question: exploration.question,
    flowchart: summaryItem?.flowchart,
    contentColumns: questionColumns,
    locale,
  });
  const showNotes = showSummarySection || showKnowledgeCard;

  if (displayMode === 'compact') {
    const compactLine = buildCompactLine({
      question: exploration.question,
      status: exploration.status,
      spinnerFrame: kineticSpinner,
      toolCount: toolNodes.length,
      isGenerating,
      wikiPersistLabel,
      compactSeparator,
    });

    return (
      <FlowInsetGroup
        focused={isLatestExploration}
        motionFrame={motionFrame}
      >
        <text wrapMode="word" fg={timelineTheme.compact.fg}>
          {compactLine}
        </text>
      </FlowInsetGroup>
    );
  }

  return (
    <FlowInsetGroup
      focused={isLatestExploration}
      motionFrame={motionFrame}
    >
      <box style={{ flexDirection: 'column', width: '100%' }}>
        <text wrapMode="none">
          <span fg={timelineTheme.summary.labelFallbackFg}>{`[${cardHeader.badge}] `}</span>
          <span fg={accentRunning ? tuiTheme.semantic.activity : timelineTheme.question.fg}>
            {cardHeader.title}
          </span>
        </text>
        <FlowMetaRow
          statusBadge={liveFootnote.statusBadge}
          statusTone={liveFootnote.statusTone}
          toolCount={liveFootnote.toolCount}
          toolsUnit={messages.toolsUnit}
          errorCount={liveFootnote.errorCount}
          toolSummary={liveFootnote.toolSummary}
          wikiPersistStatus={showWikiPersist ? wikiPersistStatus : undefined}
          wikiPersistResult={showWikiPersist ? wikiPersistResult : undefined}
          wikiTargetId={showWikiPersist ? wikiTargetId : undefined}
          wikiTurnCount={showWikiPersist ? wikiTurnCount : undefined}
        />
        {showQuestionPreview ? (
          <text wrapMode="word" fg={tuiTheme.semantic.label.tertiary}>
            {questionBody.text}
          </text>
        ) : null}
      </box>

      {showNotes ? (
        <>
          <FlowLineGap />
          {showKnowledgeCard && wikiMatch ? (
            <FlowFramedSection
              label={messages.knowledge}
              labelSuffix={formatKnowledgeSuffix(wikiMatch.entry.id, wikiMatch.score)}
              variant="knowledge"
              gap={false}
              motionFrame={motionFrame}
            >
              <WikiMatchCard
                match={wikiMatch}
                contextQuestion={exploration.question}
              />
            </FlowFramedSection>
          ) : null}
          {showSummarySection ? (
            <>
              {showKnowledgeCard && wikiMatch ? <FlowLineGap /> : null}
              <text fg={isSummaryFresh ? tuiTheme.semantic.activity : timelineTheme.summary.labelFallbackFg}>
                {formatNoteLabel(messages.summary, !isGenerating ? summaryTierLabel : undefined)}
              </text>
              {showSummaryLoading ? (
                <SummaryLoadingLine
                  spinnerFrame={kineticSpinner}
                />
              ) : (
                <text
                  wrapMode="char"
                  fg={isSummaryFresh ? tuiTheme.semantic.activity : timelineTheme.summary.body.fg}
                >
                  {buildInlineSummary(displaySummary)}
                </text>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </FlowInsetGroup>
  );
});

function SummaryLoadingLine({
  spinnerFrame,
}: {
  spinnerFrame: string;
}): ReactNode {
  const tuiTheme = useTuiTheme();
  const messages = getObserverMessages();
  const timelineTheme = tuiTheme.modes.timeline;
  return (
    <text wrapMode="none">
      <span fg={timelineTheme.summary.generating.fg}>{spinnerFrame}</span>
      <span fg={timelineTheme.summary.pending.fg}>{` ${messages.summarizing}`}</span>
    </text>
  );
}

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

function formatNoteLabel(label: string, suffix?: string): string {
  return suffix ? `${label.toUpperCase()} · ${suffix}` : label.toUpperCase();
}

function formatKnowledgeSuffix(id: string, score: number): string {
  return `${id} · ${Math.round(score * 100)}%`;
}

function buildInlineSummary(summary: string | undefined): string {
  if (!summary || !summary.trim()) {
    return 'No summary';
  }
  return formatFlowText(summary);
}
