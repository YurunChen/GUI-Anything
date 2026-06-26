/**
 * Web-only semantic tokens for exported HTML.
 *
 * TUI themes can use literal "transparent" for surfaces. In browser exports,
 * some affordances still need opaque paint (icons, scrollbars), so HTML consumes
 * these web tokens instead of raw bg.* values.
 */

import type { ColorScheme } from '../../app/ui/themes';

const FALLBACK_OPAQUE_SURFACE = '#24283b';

export interface WebThemeTokens {
  pageBackground: string;
  surfaceBackground: string;
  surfaceMuted: string;
  surfaceStrong: string;
  iconBackground: string;
  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
}

export function buildWebThemeTokens(theme: ColorScheme): WebThemeTokens {
  const surfaceIsTransparent = theme.bg.secondary === 'transparent';
  const opaqueSurface = surfaceIsTransparent ? FALLBACK_OPAQUE_SURFACE : theme.bg.secondary;

  return {
    pageBackground: theme.bg.primary,
    surfaceBackground: theme.bg.secondary,
    surfaceMuted: surfaceIsTransparent
      ? 'transparent'
      : `color-mix(in srgb, ${theme.bg.secondary} 70%, transparent)`,
    surfaceStrong: theme.bg.tertiary,
    iconBackground: opaqueSurface,
    scrollbarTrack: surfaceIsTransparent
      ? 'transparent'
      : `color-mix(in srgb, ${theme.bg.secondary} 18%, transparent)`,
    scrollbarThumb: `color-mix(in srgb, ${theme.accent.primary} 44%, ${theme.border.normal})`,
    scrollbarThumbHover: `color-mix(in srgb, ${theme.accent.primary} 64%, ${theme.border.active})`,
  };
}

export function webThemeTokensToCssVars(tokens: WebThemeTokens): string[] {
  return [
    `--page-background: ${tokens.pageBackground}`,
    `--surface-background: ${tokens.surfaceBackground}`,
    `--surface-muted: ${tokens.surfaceMuted}`,
    `--surface-strong: ${tokens.surfaceStrong}`,
    `--icon-background: ${tokens.iconBackground}`,
    `--scrollbar-track: ${tokens.scrollbarTrack}`,
    `--scrollbar-thumb: ${tokens.scrollbarThumb}`,
    `--scrollbar-thumb-hover: ${tokens.scrollbarThumbHover}`,
  ];
}
