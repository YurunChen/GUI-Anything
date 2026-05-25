import type { Exploration } from '../../../data/protocol/observer-protocol';

export type ActivityTone = 'running' | 'idle' | 'warning' | 'error';

export interface ActivityState {
  label: string;
  tone: ActivityTone;
  spinning: boolean;
}

export function deriveActivityState(input: {
  explorations: Exploration[];
  pendingSummaryCount: number;
  persistPendingCount: number;
  directionsStatus: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
}): ActivityState {
  const { explorations, pendingSummaryCount, persistPendingCount, directionsStatus } = input;
  const runningCount = explorations.filter((item) => item.status === 'running').length;
  const interruptedCount = explorations.filter((item) => item.status === 'interrupted').length;

  if (runningCount > 0) {
    return {
      label: runningCount === 1 ? 'Running tools' : `Running tools (${runningCount})`,
      tone: 'running',
      spinning: true,
    };
  }
  if (pendingSummaryCount > 0) {
    return {
      label: pendingSummaryCount === 1 ? 'Summarizing' : `Summarizing (${pendingSummaryCount})`,
      tone: 'running',
      spinning: true,
    };
  }
  if (persistPendingCount > 0) {
    return {
      label: persistPendingCount === 1 ? 'Persisting wiki' : `Persisting wiki (${persistPendingCount})`,
      tone: 'running',
      spinning: true,
    };
  }
  if (directionsStatus === 'generating') {
    return { label: 'Generating next hints', tone: 'running', spinning: true };
  }
  if (directionsStatus === 'error') {
    return { label: 'Next hints failed', tone: 'error', spinning: false };
  }
  if (interruptedCount > 0) {
    return {
      label: interruptedCount === 1 ? 'Completed with interruption' : `Completed with interruptions (${interruptedCount})`,
      tone: 'warning',
      spinning: false,
    };
  }
  return { label: '', tone: 'idle', spinning: false };
}

export function buildOutcomeSummary(input: {
  summaryCount: number;
  savedCount: number;
  skippedCount: number;
  failedCount: number;
  errorCount: number;
}): string {
  const { summaryCount, savedCount, skippedCount, failedCount, errorCount } = input;
  return `summaries ${summaryCount} · wiki saved ${savedCount} skipped ${skippedCount} failed ${failedCount} · errors ${errorCount}`;
}

