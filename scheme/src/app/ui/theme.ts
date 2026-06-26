/**
 * ABOUTME: Shared theme constants for scheme5 TUI.
 * 支持多种主题配色方案 + 运行时热切换（保持 colors 引用稳定，内部 mutation）
 */

import { useEffect, useState } from 'react';
import { themeManager } from './themes/theme-manager';
import {
  chromeHasDecorMotion,
  resolveThemeChrome,
  resolveThemeDecorInterval,
  resolveThemeProfile,
  type ThemeChrome,
  type ThemeProfile,
} from './themes/theme-profile';
import { useFlowMotionFrame, isFlowMotionEnabled } from './hooks/useFlowMotion';
import type { ColorScheme, ThemeName } from './themes';
import { buildSemanticColors, type SemanticColors } from './themes/semantic-map';
import {
  buildResolvedTuiTheme,
  type ResolvedTuiTheme,
} from './themes/resolved-theme';

// 导出主题管理器供组件使用
export { themeManager };

// ───────────────────────────────────────────────────────────
// 主题对象：引用稳定，内部值可被 mutate（用于热切换）
// ───────────────────────────────────────────────────────────

/**
 * Deep-clone the initial theme. We mutate this object in place when the user
 * switches themes so that any component that imported `colors` still reads
 * the latest values (the import binding stays valid because the reference
 * never changes).
 */
function cloneScheme(src: ColorScheme): ColorScheme {
  return JSON.parse(JSON.stringify(src)) as ColorScheme;
}

export const colors: ColorScheme = cloneScheme(themeManager.getColors());

export const semantic: SemanticColors = buildSemanticColors(colors);

export let tuiTheme: ResolvedTuiTheme = buildResolvedTuiTheme(themeManager.getCurrentTheme());

export const phaseIcons: Record<string, string> = {
  exploring: '🔍',
  executing: '✏️',
  verifying: '🧪',
  idle: '⏸',
};

// 这两个 record 也保持引用稳定，切换主题时 mutate
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

// ───────────────────────────────────────────────────────────
// 订阅机制：让 React 树在主题变化时重新渲染
// ───────────────────────────────────────────────────────────

const themeSubscribers = new Set<() => void>();

/**
 * Mutate `colors` (and derived records) to point at the requested theme,
 * then notify all subscribers so React re-renders.
 *
 * Reference identity of `colors`/`phaseColors`/`typeColors` is preserved.
 */
export function applyTheme(themeName: ThemeName): void {
  themeManager.setTheme(themeName);
  const next = themeManager.getColors();
  const nextSemantic = buildSemanticColors(next);
  tuiTheme = buildResolvedTuiTheme(themeManager.getCurrentTheme());

  // Mutate top-level groups in place
  Object.assign(colors.bg, next.bg);
  Object.assign(colors.fg, next.fg);
  Object.assign(colors.status, next.status);
  Object.assign(colors.accent, next.accent);
  Object.assign(colors.border, next.border);
  Object.assign(colors.wiki, next.wiki);

  Object.assign(semantic.label, nextSemantic.label);
  Object.assign(semantic.fill, nextSemantic.fill);
  semantic.separator = nextSemantic.separator;
  semantic.separatorActive = nextSemantic.separatorActive;
  semantic.tint = nextSemantic.tint;
  semantic.tintMuted = nextSemantic.tintMuted;
  semantic.activity = nextSemantic.activity;
  semantic.destructive = nextSemantic.destructive;
  semantic.warning = nextSemantic.warning;
  semantic.success = nextSemantic.success;
  semantic.info = nextSemantic.info;
  Object.assign(semantic.wiki, nextSemantic.wiki);

  // Rebuild derived records
  Object.assign(phaseColors, {
    exploring: colors.status.info,
    executing: colors.status.warning,
    verifying: colors.status.success,
    idle: colors.fg.muted,
  });
  Object.assign(typeColors, {
    prompt: colors.status.info,
    thinking: colors.fg.muted,
    tool_call: colors.status.warning,
    tool_result: colors.status.success,
    response: colors.fg.primary,
    group: colors.accent.secondary,
  });

  for (const fn of themeSubscribers) {
    try { fn(); } catch { /* ignore */ }
  }
}

/**
 * React hook: subscribe a component to theme changes. Returns a monotonically
 * increasing version number; when it changes the component re-renders, picking
 * up the freshly mutated `colors` values.
 *
 * Use this once near the top of the React tree (e.g. FlowObserverShell) so a
 * single state update cascades through the whole subtree.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const fn = () => setVersion(v => v + 1);
    themeSubscribers.add(fn);
    return () => { themeSubscribers.delete(fn); };
  }, []);
  return version;
}

/** Color + chrome for the active theme (`[` `]`). */
export function useThemeProfile(): ThemeProfile {
  useThemeVersion();
  return resolveThemeProfile(themeManager.getCurrentTheme());
}

/** Full TUI presentation package for the active theme. */
export function useTuiTheme(): ResolvedTuiTheme {
  useThemeVersion();
  return tuiTheme;
}

/** Symbols + spinner motion for the active color theme (`[` `]`). */
export function useThemeChrome(): ThemeChrome {
  return useTuiTheme().chrome;
}

/** Decorative motion tick for kinetic chrome (section glyphs, fresh accent). */
export function useThemeMotionFrame(active: boolean = true): number {
  useThemeVersion();
  const chrome = resolveThemeChrome(themeManager.getCurrentTheme());
  const interval = resolveThemeDecorInterval(chrome);
  const enabled = active && chromeHasDecorMotion(chrome) && isFlowMotionEnabled();
  return useFlowMotionFrame(enabled, interval);
}

export type { ThemeChrome, ThemeProfile } from './themes/theme-profile';
export type { ResolvedTuiTheme } from './themes/resolved-theme';

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
