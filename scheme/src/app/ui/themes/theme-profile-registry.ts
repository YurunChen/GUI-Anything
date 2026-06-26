/**
 * Theme profile registry — shared chrome for all color themes.
 */

import type { ThemeChrome, ThemeChromeId } from './theme-profile-types';

const CHROME_DEFAULTS: Omit<ThemeChrome, 'id'> = {
  sectionSummaryPrefix: '',
  sectionKnowledgePrefix: '',
  compactSeparator: ' · ',
  spinnerFrames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  spinnerIntervalMs: 120,
  focusConnector: '└ ',
  focusActiveSuffix: ' ·',
  cardLayout: 'inset',
  cardPadX: 2,
  cardPadY: 2,
  cardGap: 2,
  cardKnowledgeInset: 'top-rule',
  cardUseGroupedBackground: true,
  cardActiveBorder: 'left',
  cardIdleBorder: 'rounded',
};

/** Register chrome; only overrides need to be specified. */
export function defineChromeProfile(
  id: ThemeChromeId,
  overrides: Partial<Omit<ThemeChrome, 'id'>> = {},
): ThemeChrome {
  return { id, ...CHROME_DEFAULTS, ...overrides };
}

export const CALM_CHROME_OVERRIDES: Partial<Omit<ThemeChrome, 'id'>> = {
  cardLayout: 'classic',
  cardGap: 2,
  cardPadX: 2,
  cardPadY: 1,
  cardKnowledgeInset: 'full-box',
};

export const CHROME_PROFILES: Record<ThemeChromeId, ThemeChrome> = {
  calm: defineChromeProfile('calm', CALM_CHROME_OVERRIDES),
};

export const DEFAULT_CHROME_ID: ThemeChromeId = 'calm';
