/**
 * ABOUTME: Shared theme constants for scheme5 TUI.
 * Tokyo Night color palette matching ralph-tui.
 */

export const colors = {
  bg: {
    primary: '#1a1b26',
    secondary: '#24283b',
    tertiary: '#1f2335',
    highlight: '#3d4259',
  },
  fg: {
    primary: '#c0caf5',
    secondary: '#a9b1d6',
    muted: '#565f89',
    dim: '#3b4261',
  },
  status: {
    success: '#9ece6a',
    warning: '#e0af68',
    error: '#f7768e',
    info: '#7aa2f7',
  },
  accent: {
    primary: '#7aa2f7',
    secondary: '#bb9af7',
    tertiary: '#7dcfff',
  },
  border: {
    normal: '#3d4259',
    active: '#7aa2f7',
    muted: '#2f3449',
  },
};

export const phaseIcons: Record<string, string> = {
  exploring: '🔍',
  executing: '✏️',
  verifying: '🧪',
  idle: '⏸',
};

export const phaseColors: Record<string, string> = {
  exploring: colors.status.info,
  executing: colors.status.warning,
  verifying: colors.status.success,
  idle: colors.fg.muted,
};

export const typeIcons: Record<string, string> = {
  prompt: '▶',
  thinking: '💭',
  tool_call: '⚡',
  tool_result: '✓',
  response: '💬',
  group: '📁',
};

export const typeColors: Record<string, string> = {
  prompt: colors.status.info,
  thinking: colors.fg.muted,
  tool_call: colors.status.warning,
  tool_result: colors.status.success,
  response: colors.fg.primary,
  group: colors.accent.secondary,
};

/**
 * Format elapsed milliseconds to human-readable string.
 */
export function formatElapsed(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Pulse animation frames for loading indicator.
 */
export const pulseFrames = ['◷', '◶', '◵', '◴'];
