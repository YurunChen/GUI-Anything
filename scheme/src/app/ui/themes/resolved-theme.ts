import type { ColorScheme, ThemeName } from './index';
import { themes } from './index';
import { buildSemanticColors, type SemanticColors } from './semantic-map';
import {
  resolveChromeFrame,
  resolveThemeChrome,
  resolveThemeDecorInterval,
  type ThemeChrome,
} from './theme-profile';
import { resolveThemeStyleMeta, type ThemeStyleMeta } from './theme-style-registry';

export type WorkspaceActivityStatus = 'idle' | 'running' | 'ok' | 'error';
export type WorkspaceActivityAction = 'read' | 'search' | 'edit' | 'write' | 'run';

export interface TuiGlyphToken {
  fg: string;
  glyph: string;
  frames?: readonly string[];
}

export interface TuiTextToken {
  fg: string;
  bg?: string;
}

export interface TuiPanelToken {
  backgroundColor: string;
  borderColor: string;
}

export interface TimelineModeTheme {
  cardFills: {
    grouped: string;
    base: string;
    elevated: string;
    separator: string;
    tint: string;
    tintMuted: string;
    activity: string;
  };
  question: TuiTextToken;
  compact: TuiTextToken;
  summary: {
    pending: TuiTextToken;
    generating: TuiTextToken;
    body: TuiTextToken;
    labelFallbackFg: string;
  };
  meta: {
    baseFg: string;
    runningFg: string;
    interruptedFg: string;
    completeFg: string;
    errorFg: string;
    toolSummaryFg: string;
  };
}

export interface FocusModeTheme {
  panel: TuiPanelToken;
  railFg: string;
  activeRailFg: string;
  branchRepairFg: string;
  branchAlternativeFg: string;
  mergeFg: string;
  deadEndFg: string;
  labelFg: string;
  mutedFg: string;
  focusLabelFg: string;
  statusCompleteFg: string;
  statusRunningFg: string;
  statusInterruptedFg: string;
  statusErrorFg: string;
  glyphs: {
    trunk: string;
    down: string;
    forkRepair: string;
    forkAlternative: string;
    merge: string;
    deadEnd: string;
    focus: string;
    normal: string;
  };
}

export interface WorkspaceModeTheme {
  title: TuiTextToken;
  empty: TuiTextToken;
  traceTitle: TuiTextToken;
  traceEmpty: TuiTextToken;
  tree: {
    root: TuiGlyphToken;
    directory: TuiGlyphToken;
    file: TuiGlyphToken;
    active: TuiGlyphToken;
    recent: TuiTextToken;
    connectorFg: string;
  };
  action: Record<WorkspaceActivityAction, TuiGlyphToken>;
  status: Record<WorkspaceActivityStatus, TuiGlyphToken>;
}

export interface WikiModeTheme {
  panel: TuiPanelToken;
  requestFg: string;
  excerptFg: string;
  labelFg: string;
  tagBracketFg: string;
  tagColors: readonly string[];
}

export interface StatusBarModeTheme {
  backgroundColor: string;
  borderColor: string;
  metaFg: string;
  separatorFg: string;
  intentBadgeFg: string;
  intentBracketFg: string;
  intentTitleFg: string;
  idleIntentTitleFg: string;
  sessionArcFg: string;
  errorFg: string;
  notifyFg: string;
  themeNotificationFg: string;
}

export interface CommandBarModeTheme {
  backgroundColor: string;
  borderColor: string;
  activeBorderColor: string;
  textFg: string;
}

export interface TuiModeThemes {
  timeline: TimelineModeTheme;
  focus: FocusModeTheme;
  workspace: WorkspaceModeTheme;
  wiki: WikiModeTheme;
  statusBar: StatusBarModeTheme;
  commandBar: CommandBarModeTheme;
}

export interface TuiMotionTheme {
  spinnerFrames: readonly string[];
  spinnerIntervalMs: number;
  decorIntervalMs: number;
}

export interface ResolvedTuiTheme {
  name: ThemeName;
  colors: ColorScheme;
  semantic: SemanticColors;
  chrome: ThemeChrome;
  style: ThemeStyleMeta;
  modes: TuiModeThemes;
  motion: TuiMotionTheme;
}

export function buildResolvedTuiTheme(themeName: ThemeName): ResolvedTuiTheme {
  const colors = themes[themeName] ?? themes.transparent;
  const semantic = buildSemanticColors(colors);
  const chrome = resolveThemeChrome(themeName);
  return {
    name: themeName,
    colors,
    semantic,
    chrome,
    style: resolveThemeStyleMeta(themeName),
    modes: buildModeThemes(semantic, chrome),
    motion: {
      spinnerFrames: chrome.spinnerFrames,
      spinnerIntervalMs: chrome.spinnerIntervalMs,
      decorIntervalMs: resolveThemeDecorInterval(chrome),
    },
  };
}

export function resolveWorkspaceActivityToken(
  theme: ResolvedTuiTheme,
  action: WorkspaceActivityAction | string,
  status: WorkspaceActivityStatus | string,
  motionFrame: number,
): TuiGlyphToken {
  const workspace = theme.modes.workspace;
  if (status === 'error') return workspace.status.error;
  if (status === 'running') {
    const running = workspace.status.running;
    return {
      ...running,
      glyph: resolveChromeFrame(running.frames, running.glyph, motionFrame),
    };
  }
  if (status === 'ok') return workspace.status.ok;
  return workspace.action[action as WorkspaceActivityAction] ?? workspace.status.idle;
}

function buildModeThemes(semantic: SemanticColors, chrome: ThemeChrome): TuiModeThemes {
  return {
    timeline: buildTimelineModeTheme(semantic),
    focus: buildFocusModeTheme(semantic),
    workspace: buildWorkspaceModeTheme(semantic, chrome),
    wiki: buildWikiModeTheme(semantic),
    statusBar: buildStatusBarModeTheme(semantic),
    commandBar: buildCommandBarModeTheme(semantic),
  };
}

function buildTimelineModeTheme(semantic: SemanticColors): TimelineModeTheme {
  return {
    cardFills: {
      grouped: semantic.fill.grouped,
      base: semantic.fill.base,
      elevated: semantic.fill.elevated,
      separator: semantic.separator,
      tint: semantic.tint,
      tintMuted: semantic.tintMuted,
      activity: semantic.activity,
    },
    question: { fg: semantic.label.secondary },
    compact: { fg: semantic.label.secondary },
    summary: {
      pending: { fg: semantic.label.quaternary },
      generating: { fg: semantic.activity },
      body: { fg: semantic.label.secondary },
      labelFallbackFg: semantic.label.quaternary,
    },
    meta: {
      baseFg: semantic.label.quaternary,
      runningFg: semantic.activity,
      interruptedFg: semantic.warning,
      completeFg: semantic.label.tertiary,
      errorFg: semantic.destructive,
      toolSummaryFg: semantic.label.tertiary,
    },
  };
}

function buildFocusModeTheme(semantic: SemanticColors): FocusModeTheme {
  return {
    panel: {
      backgroundColor: semantic.fill.base,
      borderColor: semantic.activity,
    },
    railFg: semantic.separator,
    activeRailFg: semantic.separatorActive,
    branchRepairFg: semantic.warning,
    branchAlternativeFg: semantic.label.secondary,
    mergeFg: semantic.tintMuted,
    deadEndFg: semantic.destructive,
    labelFg: semantic.label.primary,
    mutedFg: semantic.label.secondary,
    focusLabelFg: semantic.label.primary,
    statusCompleteFg: semantic.label.secondary,
    statusRunningFg: semantic.activity,
    statusInterruptedFg: semantic.warning,
    statusErrorFg: semantic.destructive,
    glyphs: {
      trunk: '│',
      down: '↓',
      forkRepair: '├─',
      forkAlternative: '┬─',
      merge: '└─',
      deadEnd: '╰─',
      focus: '◆',
      normal: '•',
    },
  };
}

function buildWorkspaceModeTheme(
  semantic: SemanticColors,
  chrome: ThemeChrome,
): WorkspaceModeTheme {
  return {
    title: { fg: semantic.label.quaternary },
    empty: { fg: semantic.label.tertiary },
    traceTitle: { fg: semantic.label.quaternary },
    traceEmpty: { fg: semantic.label.quaternary },
    tree: {
      root: { fg: semantic.tintMuted, glyph: '▾ ' },
      directory: { fg: semantic.tintMuted, glyph: '▾ ' },
      file: { fg: semantic.label.tertiary, glyph: '· ' },
      active: { fg: semantic.activity, glyph: '● ' },
      recent: { fg: semantic.label.secondary },
      connectorFg: semantic.label.quaternary,
    },
    action: {
      read: { fg: semantic.label.tertiary, glyph: '◌' },
      search: { fg: semantic.tintMuted, glyph: '⌕' },
      edit: { fg: semantic.warning, glyph: '✎' },
      write: { fg: semantic.activity, glyph: '+' },
      run: { fg: semantic.tint, glyph: '▶' },
    },
    status: {
      idle: { fg: semantic.label.tertiary, glyph: '·' },
      running: {
        fg: semantic.activity,
        glyph: chrome.spinnerFrames[0] ?? '◷',
        frames: chrome.spinnerFrames,
      },
      ok: { fg: semantic.label.secondary, glyph: '✓' },
      error: { fg: semantic.destructive, glyph: '!' },
    },
  };
}

function buildWikiModeTheme(semantic: SemanticColors): WikiModeTheme {
  return {
    panel: {
      backgroundColor: semantic.wiki.background,
      borderColor: semantic.separator,
    },
    requestFg: semantic.label.tertiary,
    excerptFg: semantic.label.secondary,
    labelFg: semantic.wiki.labelColor,
    tagBracketFg: semantic.wiki.labelColor,
    tagColors: [
      semantic.wiki.tagColor,
      semantic.wiki.matchColor,
      semantic.wiki.labelColor,
      semantic.wiki.titleColor,
    ],
  };
}

function buildStatusBarModeTheme(semantic: SemanticColors): StatusBarModeTheme {
  return {
    backgroundColor: semantic.fill.base,
    borderColor: semantic.separator,
    metaFg: semantic.label.tertiary,
    separatorFg: semantic.label.quaternary,
    intentBadgeFg: semantic.tintMuted,
    intentBracketFg: semantic.label.quaternary,
    intentTitleFg: semantic.label.primary,
    idleIntentTitleFg: semantic.label.tertiary,
    sessionArcFg: semantic.label.tertiary,
    errorFg: semantic.destructive,
    notifyFg: semantic.label.secondary,
    themeNotificationFg: semantic.tint,
  };
}

function buildCommandBarModeTheme(semantic: SemanticColors): CommandBarModeTheme {
  return {
    backgroundColor: semantic.fill.elevated,
    borderColor: semantic.separator,
    activeBorderColor: semantic.activity,
    textFg: semantic.label.tertiary,
  };
}
