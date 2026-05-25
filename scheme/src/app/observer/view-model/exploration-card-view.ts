import type { Exploration } from '../../../data/protocol/observer-protocol';
import { truncateFlowText } from '../../../utils/flow-text';
import { getObserverMessages } from '../../ui/i18n/observer-messages';

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
  const m = getObserverMessages();

  if (input.status === 'running') {
    return {
      statusBadge: base.badge,
      statusTone: base.tone,
      toolCount: input.toolCount,
      errorCount: input.errorCount,
      toolSummary: input.toolSummary,
    };
  }

  if (input.isGenerating) {
    return {
      statusBadge: m.summarizing,
      statusTone: 'complete',
      toolCount: input.toolCount,
      errorCount: input.errorCount,
      toolSummary: input.toolSummary,
    };
  }

  return {
    statusBadge: base.badge,
    statusTone: base.tone,
    toolCount: input.toolCount,
    errorCount: input.errorCount,
    toolSummary: input.toolSummary,
  };
}

export function shouldShowInlineSummary(
  displayMode: CardDisplayMode,
  status: Exploration['status'],
  _isGenerating: boolean,
): boolean {
  if (displayMode === 'compact') return false;
  if (status === 'running') return false;
  return status === 'complete' || status === 'interrupted';
}

export interface CompactLineInput {
  question: string;
  status: Exploration['status'];
  spinnerFrame: string;
  toolCount: number;
  isGenerating: boolean;
  wikiPersistLabel?: string;
}

export function buildCompactLine(input: CompactLineInput): string {
  const m = getObserverMessages();
  const question = truncateFlowText(input.question.trim() || 'N/A', 48);
  const statusLabel = compactStatusLabel(input);
  const toolPart = `${input.toolCount} ${m.toolsUnit}`;
  const parts = [question, statusLabel, toolPart];
  if (input.wikiPersistLabel) parts.push(input.wikiPersistLabel);
  return parts.join(' · ');
}

function compactStatusLabel(input: CompactLineInput): string {
  const m = getObserverMessages();
  if (input.status === 'running') {
    return `${input.spinnerFrame} ${m.active}`;
  }
  if (input.isGenerating) {
    return m.summarizing;
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
