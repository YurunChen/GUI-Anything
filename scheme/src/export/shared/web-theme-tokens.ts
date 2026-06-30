/**
 * Web-only semantic tokens for exported HTML.
 *
 * TUI themes can use literal "transparent" for surfaces. In browser exports,
 * some affordances still need opaque paint (icons, scrollbars), so HTML consumes
 * these web tokens instead of raw bg.* values.
 */

import type { ColorScheme } from '../../app/ui/themes';

const FALLBACK_OPAQUE_SURFACE = '#24283b';
const FALLBACK_ACTIVE_FOREGROUND = '#111827';
const FALLBACK_MODAL_BACKDROP = 'rgba(13, 17, 30, .56)';

export interface WebThemeTokens {
  pageBackground: string;
  surfaceBackground: string;
  surfaceMuted: string;
  surfaceStrong: string;
  raisedSurface: string;
  overlaySurface: string;
  controlBackground: string;
  activeForeground: string;
  modalBackdrop: string;
  iconBackground: string;
  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
}

export function buildWebThemeTokens(theme: ColorScheme): WebThemeTokens {
  const pageIsTransparent = theme.bg.primary === 'transparent';
  const surfaceIsTransparent = theme.bg.secondary === 'transparent';
  const strongIsTransparent = theme.bg.tertiary === 'transparent';
  const opaqueSurface = surfaceIsTransparent ? FALLBACK_OPAQUE_SURFACE : theme.bg.secondary;
  const opaqueStrong = strongIsTransparent ? FALLBACK_OPAQUE_SURFACE : theme.bg.tertiary;

  return {
    pageBackground: theme.bg.primary,
    surfaceBackground: theme.bg.secondary,
    surfaceMuted: surfaceIsTransparent
      ? 'transparent'
      : `color-mix(in srgb, ${theme.bg.secondary} 70%, transparent)`,
    surfaceStrong: theme.bg.tertiary,
    raisedSurface: surfaceIsTransparent
      ? `color-mix(in srgb, ${opaqueSurface} 84%, transparent)`
      : `color-mix(in srgb, ${theme.bg.secondary} 60%, transparent)`,
    overlaySurface: surfaceIsTransparent
      ? `color-mix(in srgb, ${opaqueSurface} 92%, transparent)`
      : `color-mix(in srgb, ${theme.bg.secondary} 78%, transparent)`,
    controlBackground: surfaceIsTransparent || strongIsTransparent
      ? `color-mix(in srgb, ${opaqueStrong} 90%, transparent)`
      : theme.bg.tertiary,
    activeForeground: pageIsTransparent ? FALLBACK_ACTIVE_FOREGROUND : theme.bg.primary,
    modalBackdrop: pageIsTransparent
      ? FALLBACK_MODAL_BACKDROP
      : `color-mix(in srgb, ${theme.bg.primary} 70%, transparent)`,
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
    `--raised-surface: ${tokens.raisedSurface}`,
    `--overlay-surface: ${tokens.overlaySurface}`,
    `--control-background: ${tokens.controlBackground}`,
    `--active-foreground: ${tokens.activeForeground}`,
    `--modal-backdrop: ${tokens.modalBackdrop}`,
    `--icon-background: ${tokens.iconBackground}`,
    `--scrollbar-track: ${tokens.scrollbarTrack}`,
    `--scrollbar-thumb: ${tokens.scrollbarThumb}`,
    `--scrollbar-thumb-hover: ${tokens.scrollbarThumbHover}`,
  ];
}
