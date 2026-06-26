import type { ResolvedTuiTheme } from '../../theme';

export interface GraphTheme {
  laneGap: number;
  maxVisibleNodes: number;
  chars: {
    trunk: string;
    down: string;
    forkRepair: string;
    forkAlternative: string;
    merge: string;
    deadEnd: string;
    focus: string;
    normal: string;
  };
  color: {
    rail: string;
    focusRail: string;
    trunk: string;
    branchRepair: string;
    branchAlternative: string;
    merge: string;
    deadEnd: string;
    label: string;
    muted: string;
    focusLabel: string;
    statusComplete: string;
    statusRunning: string;
    statusInterrupted: string;
    statusError: string;
  };
}

export function buildGraphTheme(theme: ResolvedTuiTheme): GraphTheme {
  const focus = theme.modes.focus;
  return {
    laneGap: 4,
    maxVisibleNodes: 120,
    chars: focus.glyphs,
    color: {
      rail: focus.railFg,
      focusRail: focus.activeRailFg,
      trunk: focus.activeRailFg,
      branchRepair: focus.branchRepairFg,
      branchAlternative: focus.branchAlternativeFg,
      merge: focus.mergeFg,
      deadEnd: focus.deadEndFg,
      label: focus.labelFg,
      muted: focus.mutedFg,
      focusLabel: focus.focusLabelFg,
      statusComplete: focus.statusCompleteFg,
      statusRunning: focus.statusRunningFg,
      statusInterrupted: focus.statusInterruptedFg,
      statusError: focus.statusErrorFg,
    },
  };
}
