import type { ReactNode } from 'react';
import type { PersonalityRarity, PersonalityStripInfo } from '../../observer/view-model/personality-strip-view';
import { truncateFlowText } from '../../../utils/flow-text';
import { useTuiTheme } from '../theme';
import { flowSpacing } from './flow-ui/flow-spacing';

export interface PersonalityStripProps {
  personality?: PersonalityStripInfo | null;
  terminalWidth: number;
  motionFrame: number;
}

interface PersonalityRarityChrome {
  glyph: string;
  rarityColor: string;
  codeColor: string;
  introColor: string;
  borderColor: string;
}

interface PersonalityThemeColors {
  tint: string;
  tintMuted: string;
  activity: string;
  success: string;
  info: string;
  warning: string;
  destructive: string;
}

const RARITY_GLYPHS: Record<PersonalityRarity, readonly string[]> = {
  common: ['·', '·', '·', '·'],
  uncommon: ['✦', '·', '✧', '·'],
  rare: ['✧', '✦', '✧', '·'],
  epic: ['✦', '✧', '✹', '✧'],
  legendary: ['✹', '✦', '✷', '✧'],
  hidden: ['◆', '◇', '◆', '·'],
};

export function PersonalityStrip({ personality, terminalWidth, motionFrame }: PersonalityStripProps): ReactNode {
  const theme = useTuiTheme();
  if (!personality) return null;

  const contentWidth = Math.max(24, terminalWidth - flowSpacing.chromePadX * 2);
  const name = truncateFlowText(personality.name, Math.max(8, Math.floor(contentWidth * 0.2)));
  const intro = truncateFlowText(
    personality.intro || personality.catchphrase || personality.devStyle || '',
    Math.max(16, Math.floor(contentWidth * 0.56)),
  );
  const rarity = personality.rarity ?? 'common';
  const chrome = resolvePersonalityRarityChrome(rarity, motionFrame, theme.semantic);

  return (
    <box
      style={{
        width: '100%',
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 0,
        paddingBottom: 0,
        backgroundColor: theme.semantic.fill.elevated,
        border: ['top'],
        borderColor: chrome.borderColor,
        borderStyle: 'single',
      }}
    >
      <text wrapMode="none">
        <span fg={chrome.rarityColor}>{chrome.glyph}</span>
        <span fg={theme.semantic.label.quaternary}>{' 「Personality」 · '}</span>
        <span fg={chrome.codeColor}>{name}</span>
        {intro ? (
          <>
            <span fg={theme.semantic.label.quaternary}>{' · '}</span>
            <span fg={chrome.introColor}>{intro}</span>
          </>
        ) : null}
      </text>
    </box>
  );
}

export function resolvePersonalityPulseGlyph(
  motionFrame: number,
  rarity: PersonalityRarity = 'uncommon',
): string {
  const glyphs = RARITY_GLYPHS[rarity];
  const index = Math.max(0, Math.floor(motionFrame)) % glyphs.length;
  return glyphs[index];
}

export function resolvePersonalityBorderColor(
  motionFrame: number,
  activeColor: string,
  restingColor: string,
  rarity: PersonalityRarity = 'uncommon',
): string {
  const frame = Math.floor(Math.max(0, motionFrame));
  const activeEvery = rarity === 'common' ? 8 : rarity === 'uncommon' ? 4 : rarity === 'rare' ? 3 : 2;
  return frame % activeEvery === 0 ? activeColor : restingColor;
}

export function resolvePersonalityRarityChrome(
  rarity: PersonalityRarity,
  motionFrame: number,
  colors: PersonalityThemeColors,
): PersonalityRarityChrome {
  const glyph = resolvePersonalityPulseGlyph(motionFrame, rarity);
  const borderColor = resolvePersonalityBorderColor(
    motionFrame,
    resolveRarityActiveColor(rarity, colors),
    resolveRarityRestColor(rarity, colors),
    rarity,
  );

  switch (rarity) {
    case 'common':
      return {
        glyph,
        rarityColor: colors.tintMuted,
        codeColor: colors.tintMuted,
        introColor: colors.activity,
        borderColor,
      };
    case 'uncommon':
      return {
        glyph,
        rarityColor: colors.success,
        codeColor: colors.success,
        introColor: colors.activity,
        borderColor,
      };
    case 'rare':
      return {
        glyph,
        rarityColor: colors.info,
        codeColor: colors.tint,
        introColor: colors.info,
        borderColor,
      };
    case 'epic':
      return {
        glyph,
        rarityColor: colors.warning,
        codeColor: colors.warning,
        introColor: colors.activity,
        borderColor,
      };
    case 'legendary':
      return {
        glyph,
        rarityColor: colors.warning,
        codeColor: colors.warning,
        introColor: colors.tint,
        borderColor,
      };
    case 'hidden':
      return {
        glyph,
        rarityColor: colors.destructive,
        codeColor: colors.warning,
        introColor: colors.destructive,
        borderColor,
      };
  }
}

function resolveRarityActiveColor(rarity: PersonalityRarity, colors: PersonalityThemeColors): string {
  switch (rarity) {
    case 'common':
      return colors.tintMuted;
    case 'uncommon':
      return colors.success;
    case 'rare':
      return colors.info;
    case 'epic':
    case 'legendary':
      return colors.warning;
    case 'hidden':
      return colors.destructive;
  }
}

function resolveRarityRestColor(rarity: PersonalityRarity, colors: PersonalityThemeColors): string {
  switch (rarity) {
    case 'common':
      return colors.tintMuted;
    case 'uncommon':
      return colors.tintMuted;
    case 'rare':
      return colors.tint;
    case 'epic':
      return colors.activity;
    case 'legendary':
      return colors.tint;
    case 'hidden':
      return colors.warning;
  }
}
