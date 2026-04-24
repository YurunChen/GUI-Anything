import type {
  PhaseState,
  PhaseType,
  RepeatAlert,
  ActivityTree
} from '../core/types';

const EXPLORING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'Search', 'LS']);
const EXECUTING_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);

const VERIFYING_KEYWORDS = ['test', 'pytest', 'jest', 'mocha', 'build', 'lint', 'compile', 'run'];

const REPEAT_THRESHOLD_WARN = 3;
const REPEAT_THRESHOLD_ERROR = 5;

export interface AnalysisResult {
  phase: PhaseState;
  alerts: RepeatAlert[];
}

export function analyzeActivity(
  recentToolNames: string[],
  recentBashCommands: string[],
  tree: ActivityTree
): AnalysisResult {
  return {
    phase: detectPhase(recentToolNames, recentBashCommands, tree.phase),
    alerts: detectRepeats(recentToolNames)
  };
}

function detectPhase(
  recentToolNames: string[],
  recentBashCommands: string[],
  currentPhase: PhaseState
): PhaseState {
  if (recentToolNames.length === 0) {
    return currentPhase.history.length === 0
      ? { current: 'idle', history: [] }
      : { current: currentPhase.current, history: currentPhase.history };
  }

  const recent = recentToolNames.slice(-8);

  const hasVerifying = recent.some((name, i) => {
    if (name === 'Bash') {
      const cmd = recentBashCommands[i] ?? '';
      return VERIFYING_KEYWORDS.some(kw => cmd.includes(kw));
    }
    return false;
  });

  const hasExecuting = recent.some(name => EXECUTING_TOOLS.has(name));
  const hasExploring = recent.some(name => EXPLORING_TOOLS.has(name)) || recent.some(name => name === 'Bash');

  // Priority: verifying > executing > exploring
  let newPhase: PhaseType;
  if (hasVerifying) {
    newPhase = 'verifying';
  } else if (hasExecuting) {
    newPhase = 'executing';
  } else if (hasExploring) {
    newPhase = 'exploring';
  } else {
    newPhase = 'idle';
  }

  if (newPhase !== currentPhase.current) {
    const now = Date.now();
    const history = [...currentPhase.history];
    if (history.length > 0) {
      history[history.length - 1].endedAt = now;
    }
    history.push({ phase: newPhase, startedAt: now });
    return { current: newPhase, history };
  }

  return currentPhase;
}

function detectRepeats(recentToolNames: string[]): RepeatAlert[] {
  const alerts: RepeatAlert[] = [];
  const counts = new Map<string, number>();
  for (const name of recentToolNames) {
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  for (const [tool, count] of counts) {
    if (count >= REPEAT_THRESHOLD_WARN) {
      const severity: 'warn' | 'error' =
        count >= REPEAT_THRESHOLD_ERROR ? 'error' : 'warn';
      alerts.push({
        tool,
        params: '',
        count,
        firstSeen: Date.now(),
        severity
      });
    }
  }

  return alerts;
}
