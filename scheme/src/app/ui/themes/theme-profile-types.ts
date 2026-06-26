/**
 * Theme profile types — colors vary by ThemeName; chrome is shared by modes.
 */

import type { ColorScheme, ThemeName } from './index';
import type { ThemeStyleMeta } from './theme-style-registry';

export type ThemeChromeId = 'calm';

export type ThemeCardLayout =
  | 'classic'
  | 'minimal'
  | 'ghost'
  | 'rail'
  | 'inset'
  | 'panel'
  | 'ledger'
  | 'framed';
export type ThemeCardKnowledgeInset = 'top-rule' | 'full-box' | 'flat';

export type ThemeCardActiveBorder = 'left' | 'rounded';
export type ThemeCardIdleBorder = 'rounded' | 'single';
export type ThemeSectionKind = 'summary' | 'knowledge';

/** Symbols + motion — shared across color themes. */
export interface ThemeChrome {
  id: ThemeChromeId;
  sectionSummaryPrefix: string;
  sectionKnowledgePrefix: string;
  compactSeparator: string;
  spinnerFrames: readonly string[];
  spinnerIntervalMs: number;
  focusConnector: string;
  focusActiveSuffix: string;
  /** Timeline card shell layout — register per chrome preset. */
  cardLayout: ThemeCardLayout;
  cardPadX: number;
  cardPadY: number;
  cardGap: number;
  cardKnowledgeInset: ThemeCardKnowledgeInset;
  cardUseGroupedBackground: boolean;
  cardActiveBorder: ThemeCardActiveBorder;
  cardIdleBorder: ThemeCardIdleBorder;
  /** Rotating section prefixes (kinetic themes). Falls back to section*Prefix. */
  sectionSummaryFrames?: readonly string[];
  sectionKnowledgeFrames?: readonly string[];
  /** Rotating suffix on the active focus rail row. */
  focusActiveFrames?: readonly string[];
  /** Leading accent glyph while a card is fresh. */
  freshAccentFrames?: readonly string[];
  /** Decorative motion tick; defaults to spinnerIntervalMs. */
  decorMotionIntervalMs?: number;
  /** Running card border color cycle (hex). */
  cardBorderAccentFrames?: readonly string[];
  /** Fresh card border color cycle (hex). */
  cardBorderFreshFrames?: readonly string[];
  /** Left rail glyphs while running. */
  runningLeadFrames?: readonly string[];
  /** Status badge glyph while running (replaces spinner prefix). */
  runningBadgeFrames?: readonly string[];
  compactSeparatorFrames?: readonly string[];
  /** Section header label color cycle (hex). */
  sectionSummaryColorFrames?: readonly string[];
  sectionKnowledgeColorFrames?: readonly string[];
  /** Knowledge inset top-rule color cycle (hex). */
  knowledgeBorderColorFrames?: readonly string[];
  focusConnectorFrames?: readonly string[];
}

/** Resolved view for UI — always use resolveThemeProfile(name), not raw maps. */
export interface ThemeProfile {
  name: ThemeName;
  colors: ColorScheme;
  chrome: ThemeChrome;
  style: ThemeStyleMeta;
}

export interface ThemeChromeBinding {
  chromeId: ThemeChromeId;
  themes: readonly ThemeName[];
}

export interface CardBorderChromeInput {
  accent: boolean;
  fresh: boolean;
  /** Latest card in the timeline — keeps left-rail highlight after completion. */
  focused: boolean;
}

export interface CardBorderChromeStyle {
  border: boolean | ['left'] | false;
  borderColor: string;
  borderStyle: 'single' | 'rounded';
}

export type ThemeCardBorderSides = 'top' | 'right' | 'bottom' | 'left';

export interface CardShellChrome {
  layout: ThemeCardLayout;
  padX: number;
  padY: number;
  gap: number;
  backgroundColor: string;
  border: boolean | ThemeCardBorderSides[];
  borderColor: string;
  borderStyle: 'single' | 'rounded' | 'double' | 'heavy';
  knowledgeInset: ThemeCardKnowledgeInset;
  showLeadColumn: boolean;
}

export interface KnowledgeInsetChrome {
  border: boolean | ['top'] | false;
  borderColor: string;
  borderStyle: 'single' | 'rounded';
  backgroundColor: string;
  padX: number;
  padY: number;
}
