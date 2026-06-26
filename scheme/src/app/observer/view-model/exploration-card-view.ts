import type { Exploration } from '../../../data/protocol/observer-protocol';
import { foldFlowTextPreview, formatFlowText, truncateFlowText } from '../../../utils/flow-text';
import type { ObserverLocale } from '../../../constants/observer-locale';
import { sessionIntentDisplayLabel } from '../../../constants/session-intent-keys';
import { getObserverMessages } from '../../ui/i18n/observer-messages';

export const QUESTION_PREVIEW_MAX_LINES = 3;

export type CardDisplayMode = 'compact' | 'expanded';

export type FlowStatusTone = 'complete' | 'running' | 'interrupted';

export interface CardDisplayInput {
  calmMode: boolean;
  /** When calm is on, only the latest exploration stays expanded. */
  isLatestExploration?: boolean;
  manuallyExpanded?: boolean;
}

export function resolveCardDisplayMode(input: CardDisplayInput): CardDisplayMode {
  if (input.manuallyExpanded) return 'expanded';
  if (!input.calmMode) return 'expanded';
  if (input.isLatestExploration) return 'expanded';
  return 'compact';
}

export interface LiveFootnoteInput {
  status: Exploration['status'];
  spinnerFrame: string;
  toolCount: number;
  errorCount: number;
  toolSummary?: string;
  isGenerating: boolean;
}

export interface LiveFootnoteView {
  statusBadge: string;
  statusTone: FlowStatusTone;
  toolCount: number;
  errorCount: number;
  toolSummary?: string;
}

export function buildLiveFootnote(input: LiveFootnoteInput): LiveFootnoteView {
  const base = getStatusInfo(input.status, input.spinnerFrame);

  return {
    statusBadge: base.badge,
    statusTone: base.tone,
    toolCount: input.toolCount,
    errorCount: input.errorCount,
    toolSummary: input.toolSummary,
  };
}

/** Timeline cards follow the original model: summary appears only after the turn has output. */
export function shouldShowSummarySection(
  displayMode: CardDisplayMode,
  status: Exploration['status'],
): boolean {
  if (displayMode === 'compact') return false;
  return status === 'complete' || status === 'interrupted';
}

export function shouldRenderTimelineSummary(input: {
  displayMode: CardDisplayMode;
  status: Exploration['status'];
  isGenerating: boolean;
  summary?: string;
}): boolean {
  if (!shouldShowSummarySection(input.displayMode, input.status)) return false;
  return true;
}

export interface CompactLineInput {
  question: string;
  status: Exploration['status'];
  spinnerFrame: string;
  toolCount: number;
  isGenerating: boolean;
  wikiPersistLabel?: string;
  compactSeparator?: string;
}

export function resolveQuestionBody(input: {
  question: string;
  contentColumns: number;
  expanded: boolean;
}): { text: string; truncated: boolean } {
  if (input.expanded) {
    return { text: formatFlowText(input.question) || 'N/A', truncated: false };
  }
  return foldFlowTextPreview(
    input.question,
    input.contentColumns,
    QUESTION_PREVIEW_MAX_LINES,
  );
}

export function buildCompactLine(input: CompactLineInput): string {
  const m = getObserverMessages();
  const question = truncateFlowText(input.question.trim() || 'N/A', 48);
  const statusLabel = compactStatusLabel(input);
  const toolPart = `${input.toolCount} ${m.toolsUnit}`;
  const parts = [question, statusLabel, toolPart];
  if (input.wikiPersistLabel) parts.push(input.wikiPersistLabel);
  return parts.join(input.compactSeparator ?? ' · ');
}

export function buildTimelineCardHeader(input: {
  question: string;
  flowchart?: { intentKey: string; nodeTitle: string };
  contentColumns: number;
  locale?: ObserverLocale;
}): { badge: string; title: string } {
  const badge = input.flowchart
    ? sessionIntentDisplayLabel(input.flowchart.intentKey, input.locale) ?? 'Task'
    : 'Task';
  const rawTitle = input.flowchart?.nodeTitle?.trim() || input.question.trim() || 'N/A';
  const titleWidth = Math.max(8, input.contentColumns - badge.length - 4);
  return {
    badge,
    title: truncateFlowText(formatFlowText(rawTitle), titleWidth),
  };
}

export function buildTimelineMetaLine(input: {
  statusBadge: string;
  toolCount: number;
  errorCount: number;
  toolSummary?: string;
  wikiPersistLabel?: string;
  toolsUnit?: string;
}): string {
  const parts = [
    input.statusBadge,
    `${input.toolCount} ${input.toolsUnit ?? 'tools'}`,
  ];
  if (input.toolSummary) parts.push(input.toolSummary);
  if (input.errorCount > 0) parts.push(`${input.errorCount} errors`);
  if (input.wikiPersistLabel) parts.push(input.wikiPersistLabel);
  return parts.join(' · ');
}

function compactStatusLabel(input: CompactLineInput): string {
  const m = getObserverMessages();
  if (input.status === 'running') {
    return `${input.spinnerFrame} ${m.active}`;
  }
  if (input.isGenerating) {
    return `${input.spinnerFrame} ${m.summarizing}`;
  }
  if (input.status === 'interrupted') {
    return m.interrupted;
  }
  return m.done;
}

function getStatusInfo(
  status: Exploration['status'],
  spinnerFrame: string,
): { badge: string; tone: FlowStatusTone } {
  const m = getObserverMessages();
  switch (status) {
    case 'complete':
      return { badge: m.done, tone: 'complete' };
    case 'interrupted':
      return { badge: m.interrupted, tone: 'interrupted' };
    case 'running':
      return { badge: `${spinnerFrame} ${m.active}`, tone: 'running' };
    default: {
      const _exhaustive: never = status;
      return { badge: String(_exhaustive), tone: 'complete' };
    }
  }
}
