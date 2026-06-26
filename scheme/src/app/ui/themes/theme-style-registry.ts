/**
 * Theme style — shared by every color palette.
 *
 * View modes own layout and chrome. Themes only supply colors.
 */

import { themes, type ThemeName } from './index';
import type { ThemeChrome, ThemeChromeBinding } from './theme-profile-types';
import { CALM_CHROME_OVERRIDES, defineChromeProfile } from './theme-profile-registry';

export type ThemeStyleFamilyId = 'terminal';

export interface ThemeStyleMeta {
  family: ThemeStyleFamilyId;
  /** Shown during `[` `]` switch animation */
  familyLabel: string;
  switchFrames: readonly string[];
  switchIntervalMs: number;
}

export interface ThemeStyleEntry {
  meta: ThemeStyleMeta;
  chrome: ThemeChrome;
}

export const SHARED_THEME_STYLE: ThemeStyleEntry = {
  meta: {
    family: 'terminal',
    familyLabel: 'Terminal',
    switchFrames: ['░', '▒', '▓', '▒'],
    switchIntervalMs: 90,
  },
  chrome: defineChromeProfile('calm', {
    ...CALM_CHROME_OVERRIDES,
    cardUseGroupedBackground: true,
    spinnerIntervalMs: 100,
  }),
};

export const THEME_STYLES: Record<ThemeName, ThemeStyleEntry> = Object.fromEntries(
  (Object.keys(themes) as ThemeName[]).map((name) => [name, SHARED_THEME_STYLE]),
) as Record<ThemeName, ThemeStyleEntry>;

export function resolveThemeStyleMeta(_themeName: ThemeName): ThemeStyleMeta {
  return SHARED_THEME_STYLE.meta;
}

export function resolveThemeStyleChrome(_themeName: ThemeName): ThemeChrome {
  return SHARED_THEME_STYLE.chrome;
}

export const CHROME_BY_THEME: Record<ThemeName, ThemeChrome> = Object.fromEntries(
  (Object.keys(themes) as ThemeName[]).map((name) => [name, SHARED_THEME_STYLE.chrome]),
) as Record<ThemeName, ThemeChrome>;

/** @deprecated Use THEME_STYLES family bindings */
export const THEME_CHROME_BINDINGS: readonly ThemeChromeBinding[] = [
  { chromeId: 'calm', themes: Object.keys(themes) as ThemeName[] },
];

export function validateThemeStyleRegistry(themeNames: readonly ThemeName[]): string[] {
  const errors: string[] = [];
  for (const name of themeNames) {
    if (!themes[name]) {
      errors.push(`theme missing style entry: ${name}`);
    }
  }
  return errors;
}

export function validateThemeChromeRegistry(): string[] {
  return validateThemeStyleRegistry(Object.keys(themes) as ThemeName[]);
}
