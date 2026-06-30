/**
 * Semantic color tokens — theme-agnostic aliases over ColorScheme.
 * Maps theme slots: fg.default/muted, bg.base/surface/overlay, accent, status.
 *
 * Layering (dark): base (primary) → grouped (secondary) → elevated (tertiary) → highlight.
 */

import type { ColorScheme } from './index';

export interface SemanticColors {
  label: {
    /** fg.default — body */
    primary: string;
    /** fg.secondary */
    secondary: string;
    /** fg.muted — metadata, section labels */
    tertiary: string;
    /** fg.dim — footnotes */
    quaternary: string;
  };
  fill: {
    /** bg.base */
    base: string;
    /** bg.surface — panels, grouped cards */
    grouped: string;
    /** bg.overlay — nested inset, wiki */
    elevated: string;
    /** bg.selection — row highlight */
    highlight: string;
  };
  separator: string;
  separatorActive: string;
  tint: string;
  tintMuted: string;
  /** Running / fresh — secondary emphasis, not primary accent */
  activity: string;
  destructive: string;
  warning: string;
  success: string;
  info: string;
  wiki: ColorScheme['wiki'];
}

export function buildSemanticColors(scheme: ColorScheme): SemanticColors {
  return {
    label: {
      primary: scheme.fg.primary,
      secondary: scheme.fg.secondary,
      tertiary: scheme.fg.muted,
      quaternary: scheme.fg.dim,
    },
    fill: {
      base: scheme.bg.primary,
      grouped: scheme.bg.secondary,
      elevated: scheme.bg.tertiary,
      highlight: scheme.bg.highlight,
    },
    separator: scheme.border.muted,
    separatorActive: scheme.border.active,
    tint: scheme.accent.primary,
    tintMuted: scheme.accent.tertiary,
    activity: scheme.fg.secondary,
    destructive: scheme.status.error,
    warning: scheme.status.warning,
    success: scheme.status.success,
    info: scheme.status.info,
    wiki: { ...scheme.wiki },
  };
}
