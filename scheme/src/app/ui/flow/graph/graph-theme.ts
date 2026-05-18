import { colors } from '../../theme';

export const graphTheme = {
  laneGap: 3,
  maxVisibleNodes: 120,
  chars: {
    trunk: '│',
    forkRepair: '├─',
    forkAlternative: '┬─',
    merge: '└─',
    deadEnd: '╰─',
    focus: '◆',
    normal: '•',
  },
  color: {
    rail: colors.border.normal,
    focusRail: colors.border.active,
    trunk: colors.border.active,
    branchRepair: colors.status.warning,
    branchAlternative: colors.accent.secondary,
    merge: colors.accent.primary,
    deadEnd: colors.status.error,
    label: colors.fg.primary,
    muted: colors.fg.secondary,
    focusLabel: colors.accent.tertiary,
    statusComplete: colors.status.success,
    statusRunning: colors.status.info,
    statusInterrupted: colors.status.warning,
    statusError: colors.status.error,
  },
};
