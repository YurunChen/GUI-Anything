/**
 * Semantic color tokens — theme-agnostic aliases over ColorScheme.
 * Components should prefer `semantic` over raw accent/status for chrome and labels.
 *
 * Tokyo Night role mapping (default theme):
 * - tint / focus accent / ▸ marker → accent.primary (#7aa2f7)
 * - label.tertiary / footnotes → fg.muted (#565f89)
 * - label.primary body → fg.primary (#c0caf5)
 * - wiki.titleColor → wiki.title only (Knowledge section), not global headings
 * - destructive / warning → status.error / status.warning only
 */

import type { ColorScheme } from './index';

export interface SemanticColors {
  label: {
    primary: string;
    secondary: string;
    tertiary: string;
    quaternary: string;
  };
  fill: {
    base: string;
    grouped: string;
    elevated: string;
    highlight: string;
  };
  separator: string;
  separatorActive: string;
  /** Interactive / link emphasis — use sparingly */
  tint: string;
  tintMuted: string;
  /** Running / summarizing activity — muted, not accent blue */
  activity: string;
  destructive: string;
  warning: string;
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
    wiki: { ...scheme.wiki },
  };
}
