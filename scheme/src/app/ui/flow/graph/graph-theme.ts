import { semantic } from '../../theme';

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

/** Read fresh semantic colors (supports theme hot-switch). */
export function buildGraphTheme(): GraphTheme {
  return {
    laneGap: 4,
    maxVisibleNodes: 120,
    chars: {
      trunk: '│',
      down: '↓',
      forkRepair: '├─',
      forkAlternative: '┬─',
      merge: '└─',
      deadEnd: '╰─',
      focus: '◆',
      normal: '•',
    },
    color: {
      rail: semantic.separator,
      focusRail: semantic.separatorActive,
      trunk: semantic.separatorActive,
      branchRepair: semantic.warning,
      branchAlternative: semantic.label.secondary,
      merge: semantic.tintMuted,
      deadEnd: semantic.destructive,
      label: semantic.label.primary,
      muted: semantic.label.secondary,
      focusLabel: semantic.label.primary,
      statusComplete: semantic.label.secondary,
      statusRunning: semantic.activity,
      statusInterrupted: semantic.warning,
      statusError: semantic.destructive,
    },
  };
}
