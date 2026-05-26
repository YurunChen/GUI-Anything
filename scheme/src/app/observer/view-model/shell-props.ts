import type { ActivityTree } from '../../../domain/types';
import type {
  Exploration,
  PersistResult,
  SessionIntentState,
  SessionScopedId,
  SummaryItem,
} from '../../../data/protocol/observer-protocol';
import type { SessionPresentationMode } from '../../../services/session/session-runtime-policy';
import type { ObserverStatusBarViewProps } from './shell-chrome.types';
import { buildLiveIntentChrome } from './intent-chrome';
import { buildSessionArc } from './session-arc';
import { indexSummaryItemsByExploration } from '../../../data/protocol/summary-contract';

export interface ShellChromeInput {
  sessionId?: string;
  sessionPresentationMode: SessionPresentationMode;
  explorations: Exploration[];
  tree: ActivityTree | null;
  runtimeModel: string;
  tokenDisplay: string;
  notifyStatus?: string;
  themeNotification?: string;
  pendingSummaryCount: number;
  explorationSummaries: Record<string, string>;
  explorationPersistStatus: Record<string, 'saved' | 'updated' | 'skipped' | 'failed' | 'pending'>;
  explorationPersistResults?: Record<string, PersistResult>;
  summaryItems?: Record<SessionScopedId, SummaryItem>;
  sessionIntent?: SessionIntentState | null;
  terminalWidth: number;
}

export interface ShellChromeProps {
  statusBar: ObserverStatusBarViewProps;
}

export function buildShellChromeProps(input: ShellChromeInput): ShellChromeProps {
  const completedCount = input.explorations.filter((e) => e.status === 'complete').length;
  const interruptionErrorCount = input.explorations.filter(
    (e) => (e.errorCounts.system + e.errorCounts.result) > 0,
  ).length;

  const fileAccessLine = input.tree && input.tree.fileAccess.size > 0
    ? [...input.tree.fileAccess.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => {
        const short = path.includes('/') ? path.split('/').pop()! : path;
        const warn = count >= 3 ? ' !' : '';
        return `${short}×${count}${warn}`;
      })
      .join(' · ')
    : undefined;

  const sessionArc = input.summaryItems
    ? buildSessionArc(
      input.explorations,
      indexSummaryItemsByExploration(input.summaryItems),
    )
    : undefined;

  const liveIntent = buildLiveIntentChrome({
    sessionIntent: input.sessionIntent,
    explorations: input.explorations,
    summaryItems: input.summaryItems,
  });

  return {
    statusBar: {
      sessionMode: input.sessionPresentationMode,
      runtimeModel: input.runtimeModel,
      tokenDisplay: input.tokenDisplay,
      completedCount,
      errorCount: interruptionErrorCount,
      notifyStatus: input.notifyStatus,
      themeNotification: input.themeNotification,
      terminalWidth: input.terminalWidth,
      fileAccessLine,
      sessionArc: liveIntent ? undefined : sessionArc,
      liveIntent,
    },
  };
}
