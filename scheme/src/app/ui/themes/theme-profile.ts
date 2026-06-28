/**
 * Theme profile — single resolve API for color + chrome.
 * UI should import from here (or useThemeProfile hook in theme.ts).
 */

import { themes, type ThemeName } from './index';
import {
  CHROME_PROFILES,
  DEFAULT_CHROME_ID,
} from './theme-profile-registry';
import {
  resolveThemeStyleChrome,
  resolveThemeStyleMeta,
} from './theme-style-registry';
import type {
  CardShellChromeInput,
  CardBorderChromeStyle,
  CardShellChrome,
  KnowledgeInsetChrome,
  ThemeChrome,
  ThemeProfile,
  ThemeSectionKind,
} from './theme-profile-types';

export type {
  CardShellChromeInput,
  CardBorderChromeStyle,
  CardShellChrome,
  KnowledgeInsetChrome,
  ThemeCardActiveBorder,
  ThemeCardIdleBorder,
  ThemeCardKnowledgeInset,
  ThemeCardLayout,
  ThemeChrome,
  ThemeChromeBinding,
  ThemeChromeId,
  ThemeProfile,
  ThemeSectionKind,
} from './theme-profile-types';

export {
  CHROME_PROFILES,
  DEFAULT_CHROME_ID,
  defineChromeProfile,
} from './theme-profile-registry';

export {
  CHROME_BY_THEME,
  THEME_CHROME_BINDINGS,
  THEME_STYLES,
  resolveThemeStyleMeta,
  validateThemeChromeRegistry,
  validateThemeStyleRegistry,
} from './theme-style-registry';

export function resolveThemeChrome(themeName: ThemeName): ThemeChrome {
  return resolveThemeStyleChrome(themeName);
}

export function resolveThemeProfile(themeName: ThemeName): ThemeProfile {
  return {
    name: themeName,
    colors: themes[themeName] ?? themes.transparent,
    chrome: resolveThemeChrome(themeName),
    style: resolveThemeStyleMeta(themeName),
  };
}

export function resolveSpinnerFrame(chrome: ThemeChrome, index: number): string {
  const frames = chrome.spinnerFrames;
  if (frames.length === 0) return '';
  return frames[index % frames.length] ?? frames[0];
}

export function resolveChromeFrame(
  frames: readonly string[] | undefined,
  fallback: string,
  index: number,
): string {
  if (!frames?.length) return fallback;
  return frames[index % frames.length] ?? fallback;
}

export function resolveThemeDecorInterval(chrome: ThemeChrome): number {
  return chrome.decorMotionIntervalMs ?? chrome.spinnerIntervalMs;
}

export function chromeHasDecorMotion(chrome: ThemeChrome): boolean {
  return Boolean(
    chrome.sectionSummaryFrames?.length
    || chrome.sectionKnowledgeFrames?.length
    || chrome.sectionSummaryColorFrames?.length
    || chrome.sectionKnowledgeColorFrames?.length
    || chrome.knowledgeBorderColorFrames?.length
    || chrome.focusActiveFrames?.length
    || chrome.focusConnectorFrames?.length
    || chrome.runningBadgeFrames?.length
    || chrome.cardBorderAccentFrames?.length
    || chrome.compactSeparatorFrames?.length
  );
}

export function resolveKineticSpinner(
  chrome: ThemeChrome,
  spinnerFrame: string,
  motionIndex: number,
  running: boolean,
): string {
  if (!running) return spinnerFrame;
  return resolveChromeFrame(chrome.runningBadgeFrames, spinnerFrame, motionIndex);
}

export function resolveCompactSeparator(
  chrome: ThemeChrome,
  motionIndex: number,
): string {
  return resolveChromeFrame(chrome.compactSeparatorFrames, chrome.compactSeparator, motionIndex);
}

export function resolveSectionLabelColor(
  chrome: ThemeChrome,
  kind: ThemeSectionKind,
  fallback: string,
  motionIndex: number,
): string {
  const frames = kind === 'knowledge'
    ? chrome.sectionKnowledgeColorFrames
    : chrome.sectionSummaryColorFrames;
  return resolveChromeFrame(frames, fallback, motionIndex);
}

export function formatThemeSectionLabel(
  chrome: ThemeChrome,
  kind: ThemeSectionKind,
  label: string,
  labelSuffix?: string,
  motionIndex = 0,
): string {
  const staticPrefix = kind === 'knowledge'
    ? chrome.sectionKnowledgePrefix
    : chrome.sectionSummaryPrefix;
  const frames = kind === 'knowledge'
    ? chrome.sectionKnowledgeFrames
    : chrome.sectionSummaryFrames;
  const prefix = resolveChromeFrame(frames, staticPrefix, motionIndex);
  const header = `${prefix}${label.toUpperCase()}`;
  return labelSuffix ? `${header}  ${labelSuffix}` : header;
}

export function resolveCardBorderChrome(
  chrome: ThemeChrome,
  input: CardShellChromeInput,
  colors: {
    tint: string;
    tintMuted: string;
    activity: string;
    separator: string;
    borderMuted?: string;
    borderAccentFrames?: readonly string[];
  },
  motionIndex = 0,
): CardBorderChromeStyle {
  const borderColor = resolveBorderColor(chrome, input, colors, motionIndex);
  const idleRounded = chrome.cardIdleBorder === 'rounded';

  return {
    border: true,
    borderColor,
    borderStyle: idleRounded ? 'rounded' : 'single',
  };
}

function resolveBorderColor(
  chrome: ThemeChrome,
  input: CardShellChromeInput,
  colors: {
    tint: string;
    tintMuted: string;
    borderMuted?: string;
    borderAccentFrames?: readonly string[];
    activity: string;
    separator: string;
  },
  motionIndex: number,
): string {
  let borderColor = input.focused ? colors.tint : (colors.borderMuted ?? colors.tintMuted);

  if (input.focused) {
    borderColor = resolveChromeFrame(
      colors.borderAccentFrames ?? chrome.cardBorderAccentFrames,
      borderColor,
      motionIndex,
    );
  }
  return borderColor;
}

export function resolveCardShellChrome(
  chrome: ThemeChrome,
  input: CardShellChromeInput,
  fills: {
    grouped: string;
    base: string;
    elevated: string;
    separator: string;
    tint: string;
    tintMuted: string;
    borderMuted?: string;
    borderAccentFrames?: readonly string[];
    activity: string;
  },
  motionIndex = 0,
): CardShellChrome {
  const borderColor = resolveBorderColor(chrome, input, fills, motionIndex);
  const padX = chrome.cardPadX;
  const padY = chrome.cardPadY;
  const gap = chrome.cardGap;
  const bgGrouped = chrome.cardUseGroupedBackground ? fills.grouped : fills.base;

  switch (chrome.cardLayout) {
    case 'classic':
      return {
        layout: 'classic',
        padX,
        padY,
        gap,
        backgroundColor: fills.grouped,
        border: ['left'],
        borderColor,
        borderStyle: 'heavy',
        knowledgeInset: chrome.cardKnowledgeInset,
      };
    case 'ghost':
      return {
        layout: 'ghost',
        padX,
        padY: Math.max(1, padY - 1),
        gap: Math.max(0, gap - 1),
        backgroundColor: 'transparent',
        border: ['bottom'],
        borderColor,
        borderStyle: 'single',
        knowledgeInset: chrome.cardKnowledgeInset,
      };
    case 'minimal':
      return {
        layout: 'minimal',
        padX,
        padY,
        gap,
        backgroundColor: chrome.cardUseGroupedBackground ? fills.grouped : 'transparent',
        border: false,
        borderColor,
        borderStyle: 'single',
        knowledgeInset: chrome.cardKnowledgeInset,
      };
    case 'rail':
      return {
        layout: 'rail',
        padX,
        padY,
        gap,
        backgroundColor: chrome.cardUseGroupedBackground ? fills.base : 'transparent',
        border: ['left'],
        borderColor,
        borderStyle: 'single',
        knowledgeInset: chrome.cardKnowledgeInset,
      };
    case 'panel':
      return {
        layout: 'panel',
        padX: padX + 1,
        padY,
        gap,
        backgroundColor: chrome.cardUseGroupedBackground ? fills.grouped : fills.base,
        border: ['top', 'bottom'],
        borderColor,
        borderStyle: 'single',
        knowledgeInset: chrome.cardKnowledgeInset,
      };
    case 'ledger':
      return {
        layout: 'ledger',
        padX,
        padY: Math.max(1, padY - 1),
        gap: 1,
        backgroundColor: chrome.cardUseGroupedBackground ? fills.base : 'transparent',
        border: ['top'],
        borderColor,
        borderStyle: 'single',
        knowledgeInset: chrome.cardKnowledgeInset,
      };
    case 'framed': {
      const idleBorder = chrome.cardIdleBorder === 'rounded';
      return {
        layout: 'framed',
        padX: padX + 1,
        padY: padY + 1,
        gap,
        backgroundColor: bgGrouped,
        border: true,
        borderColor,
        borderStyle: idleBorder ? 'rounded' : 'single',
        knowledgeInset: chrome.cardKnowledgeInset,
      };
    }
    case 'inset':
    default: {
      const border = resolveCardBorderChrome(
        chrome,
        input,
        {
          tint: fills.tint,
          tintMuted: fills.tintMuted,
          borderMuted: fills.borderMuted,
          borderAccentFrames: fills.borderAccentFrames,
          activity: fills.activity,
          separator: fills.separator,
        },
        motionIndex,
      );
      return {
        layout: 'inset',
        padX,
        padY,
        gap,
        backgroundColor: bgGrouped,
        border: border.border,
        borderColor: border.borderColor,
        borderStyle: border.borderStyle,
        knowledgeInset: chrome.cardKnowledgeInset,
      };
    }
  }
}

export function resolveKnowledgeInsetChrome(
  chrome: ThemeChrome,
  variant: 'knowledge' | 'neutral',
  fills: {
    wikiBackground: string;
    elevated: string;
    separator: string;
  },
  motionIndex = 0,
): KnowledgeInsetChrome {
  const isKnowledge = variant === 'knowledge';
  const ruleColor = isKnowledge
    ? resolveChromeFrame(chrome.knowledgeBorderColorFrames, fills.separator, motionIndex)
    : fills.separator;
  const bg = isKnowledge ? fills.wikiBackground : fills.elevated;
  const padY = Math.max(1, chrome.cardPadY - 1);

  switch (chrome.cardKnowledgeInset) {
    case 'flat':
      return {
        border: false,
        borderColor: ruleColor,
        borderStyle: 'single',
        backgroundColor: 'transparent',
        padX: 0,
        padY: 0,
      };
    case 'full-box':
      return {
        border: false,
        borderColor: ruleColor,
        borderStyle: 'rounded',
        backgroundColor: bg,
        padX: 2,
        padY,
      };
    case 'top-rule':
    default:
      return {
        border: ['top'],
        borderColor: ruleColor,
        borderStyle: 'single',
        backgroundColor: bg,
        padX: 1,
        padY,
      };
  }
}
