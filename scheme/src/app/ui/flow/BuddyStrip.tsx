import type { ReactNode } from 'react';
import { TextAttributes } from '@opentui/core';
import { BUDDY_TYPE_CODES, type BuddyProfile } from '../../observer/view-model/buddy-profile';
import { normalizeSessionIntentKey, type SessionIntentTaskKey } from '../../../constants/session-intent-keys';
import { lineDisplayWidth } from '../../../utils/flow-text';
import { useTuiTheme } from '../theme';
import type { ResolvedTuiTheme } from '../themes/resolved-theme';

const TIMELINE_BUDDY_COLUMNS = 12;
export const INTENT_BUDDY_COLUMNS = 20;
export const INTENT_BUDDY_ROWS = 3;
export const INTENT_BUDDY_TITLE_GAP_COLUMNS = 2;
export const BUDDY_BRAILLE_CONTOUR_CHARS = '⡠⢄⡴⢦⡶⢶' as const;
export const BUDDY_CREST_PREVIEW_MOTION_FRAMES = [0, 2, 4, 8] as const;
export type BuddyCrestMotionPhase = 0 | 1 | 2 | 3 | 4 | 5;
export const BUDDY_CREST_MOTION_SEQUENCE = [
  0, 0, 1, 0, 2, 4, 2, 0,
  3, 5, 3, 0, 1, 0, 2, 0,
] as const satisfies readonly BuddyCrestMotionPhase[];

export function resolveBuddyCrestMotionPhase(motionFrame: number): BuddyCrestMotionPhase {
  const normalized = Math.max(0, Math.floor(motionFrame));
  return BUDDY_CREST_MOTION_SEQUENCE[normalized % BUDDY_CREST_MOTION_SEQUENCE.length];
}

export interface BuddyStripProps {
  profile: BuddyProfile | null;
  availableWidth: number;
  motionFrame: number;
  surface?: 'panel' | 'inline';
}

export interface BuddyStripPresentation {
  showAvatar: boolean;
  avatarColumns: number;
  avatarRows: readonly string[];
  entryIndent: number;
}

export type BuddyGlyphTone = 'outline' | 'accent' | 'spark' | 'eye' | 'frame';

export interface BuddyGlyphStyle {
  fg: string;
  bg?: string;
  attributes: number;
}

export interface BuddyCrestPalette {
  baseBg: string;
  alternateBg: string;
  frameBg: string;
  focusBg: string;
  outlineFg: string;
  accentFg: string;
  frameFg: string;
  eyeFg: string;
  sparkFg: string;
}

export type BuddyCrestColorway = Omit<BuddyCrestPalette, 'baseBg'>;

export const BUDDY_GLYPH_TONE_CHARACTERS = {
  frame: '▏▕▌▐▊▎',
  eye: 'oO◉─-e',
  spark: '·✦✧⠂⠐⠋⠙⟡',
  accent: `v∨∧▿▵△▽▸▶^ᴥ⌄⌃╽╳│_|✓◆◇◈~≈∴⋅∪◜◝╭╮╰╯╱╲═┬┴⌂⋈↗□▣⌕⌾∽${BUDDY_BRAILLE_CONTOUR_CHARS}`,
} as const;

export const BUDDY_CREST_COLORWAYS: Record<BuddyProfile['code'], BuddyCrestColorway> = {
  ARC: {
    alternateBg: '#1d3147',
    frameBg: '#24324a',
    focusBg: '#18243a',
    outlineFg: '#8aa9d6',
    accentFg: '#8fd3ff',
    frameFg: '#7dd3fc',
    eyeFg: '#f3f7ff',
    sparkFg: '#ffd166',
  },
  VIB: {
    alternateBg: '#30254a',
    frameBg: '#2d3252',
    focusBg: '#261f42',
    outlineFg: '#a8b3d8',
    accentFg: '#b79cff',
    frameFg: '#86efac',
    eyeFg: '#f8fbff',
    sparkFg: '#ffd166',
  },
  DBG: {
    alternateBg: '#3c2430',
    frameBg: '#3a2a35',
    focusBg: '#321f2b',
    outlineFg: '#e29a8f',
    accentFg: '#ff9b73',
    frameFg: '#fbbf24',
    eyeFg: '#fff7ed',
    sparkFg: '#facc15',
  },
  SHIP: {
    alternateBg: '#203b37',
    frameBg: '#233b4a',
    focusBg: '#183036',
    outlineFg: '#92c9db',
    accentFg: '#7dd3fc',
    frameFg: '#86efac',
    eyeFg: '#f0fdff',
    sparkFg: '#f8d568',
  },
  CUR: {
    alternateBg: '#3c2f1f',
    frameBg: '#3c3328',
    focusBg: '#322919',
    outlineFg: '#d1a66f',
    accentFg: '#f2a93b',
    frameFg: '#5eead4',
    eyeFg: '#fff4df',
    sparkFg: '#f7c948',
  },
  EXP: {
    alternateBg: '#263457',
    frameBg: '#27364f',
    focusBg: '#1d2a47',
    outlineFg: '#9eb7e6',
    accentFg: '#93c5fd',
    frameFg: '#7dd3fc',
    eyeFg: '#f8fafc',
    sparkFg: '#c4b5fd',
  },
};

interface InlineBuddyCrestArtwork {
  stable: readonly string[];
  blink?: readonly string[];
  lift?: readonly string[];
  pulse?: readonly string[];
}

interface InlineBuddyCrestIntentArtwork extends InlineBuddyCrestArtwork {
  code: BuddyProfile['code'];
}

export interface BuddyCrestDesign {
  animal: 'owl' | 'butterfly' | 'fox' | 'swallow' | 'squirrel' | 'dog';
  intentSignal: 'architecture' | 'motion' | 'debugging' | 'shipping' | 'knowledge' | 'exploration';
  landmark: RegExp;
  anchors: {
    silhouette: RegExp;
    expression: RegExp;
    intentCue: RegExp;
  };
}

export const BUDDY_CREST_DESIGN: Record<BuddyProfile['code'], BuddyCrestDesign> = {
  ARC: {
    animal: 'owl',
    intentSignal: 'architecture',
    landmark: /╭∧⌂∧╮.*[◉─][╲╱][⌄⌃][╱╲][◉─]/s,
    anchors: {
      silhouette: /[⡴⡶]╭∧⌂∧╮[⢦⢶]/,
      expression: /[◉─][╲╱][⌄⌃][╱╲][◉─]/,
      intentCue: /[⌂✦✧⟡◇·]/,
    },
  },
  VIB: {
    animal: 'butterfly',
    intentSignal: 'motion',
    landmark: /╭[╲╱][│╽][╱╲]╮.*[◉─][╲╱][│╽][╱╲][◉─]/s,
    anchors: {
      silhouette: /[⡶]╭[╲╱][│╽][╱╲]╮[⢶]/,
      expression: /[◉─][╲╱][│╽][╱╲][◉─]/,
      intentCue: /[≈✦✧⟡·]/,
    },
  },
  DBG: {
    animal: 'fox',
    intentSignal: 'debugging',
    landmark: /△[╲╱][╳◆][╱╲]△.*[◉─][╲╱][▿▵][╱╲][◉─]/s,
    anchors: {
      silhouette: /[⡶]△[╲╱][╳◆][╱╲]△[⢶]/,
      expression: /[◉─][╲╱][▿▵][╱╲][◉─]/,
      intentCue: /[╳◆✦✧⟡·]/,
    },
  },
  SHIP: {
    animal: 'swallow',
    intentSignal: 'shipping',
    landmark: /[╲╱]∧[▸✓]∧[╱╲].*[╲╱][◉─][▸✓][◉─][╱╲]/s,
    anchors: {
      silhouette: /[⡴⡶][╲╱]∧[▸✓]∧[╱╲][⢦⢶]/,
      expression: /[╲╱][◉─][▸✓][◉─][╱╲]/,
      intentCue: /[↗✓▸✦✧⟡·]/,
    },
  },
  CUR: {
    animal: 'squirrel',
    intentSignal: 'knowledge',
    landmark: /[∽~⟡][⡴⡶]◜╭[⌾□◇]╮◝[⢦⢶].*[◉─]╮ᴥ╭[◉─]/s,
    anchors: {
      silhouette: /[∽~⟡][⡴⡶]◜╭[⌾□◇]╮◝[⢦⢶]/,
      expression: /[◉─]╮ᴥ╭[◉─]/,
      intentCue: /[∽□◇✦✧⟡·]/,
    },
  },
  EXP: {
    animal: 'dog',
    intentSignal: 'exploration',
    landmark: /[⡴⡶]╭∪[⌕▶]∪╮[⢦⢶].*[◉─]╮[ᴥ△]╭[◉─]/s,
    anchors: {
      silhouette: /[⡴⡶]╭∪[⌕▶]∪╮[⢦⢶]/,
      expression: /[◉─]╮[ᴥ△]╭[◉─]/,
      intentCue: /[⌕◇◆✦✧⟡·]/,
    },
  },
};

export const INLINE_BUDDY_CREST_ART: Record<BuddyProfile['code'], InlineBuddyCrestArtwork> = {
  ARC: {
    stable: ['⟡⡴╭∧⌂∧╮⢦⌂✦', '·⡴◉╲⌄╱◉⢦╱⌂', '✦⢦╰═⌂═╯⡴⟡·'],
    blink: ['·⡴╭∧⌂∧╮⢦⌂◇', '·⡴─╲⌄╱─⢦╱⌂', '·⢦╰═⌂═╯⡴⟡·'],
    lift: ['◇⡶╭∧⌂∧╮⢶⌂✧', '·⡶◉╲⌃╱◉⢶╱⌂', '✧⢶╰═⌂═╯⡶⟡·'],
    pulse: ['⟡⡴╭∧⌂∧╮⢦⌂◇', '◇⡴◉╲⌄╱◉⢦╱⌂', '·⢦╰═⌂═╯⡴✦·'],
  },
  VIB: {
    stable: ['✦⡶╭╲╽╱╮⢶⋈✧', '·⡶◉╲╽╱◉⢶≈⋈', '✧╰╱╲╽╱╲╯≈·'],
    blink: ['·⡶╭╲╽╱╮⢶⋈✧', '·⡶─╲╽╱─⢶≈⋈', '·╰╱╲╽╱╲╯≈✧'],
    lift: ['✧⡶╭╱│╲╮⢶⋈✦', '·⡶◉╱│╲◉⢶≈⋈', '✦╰╲╱│╲╱╯≈·'],
    pulse: ['⟡⡶╭╲╽╱╮⢶⋈✧', '✦⡶◉╲╽╱◉⢶≈⋈', '·╰╱╲╽╱╲╯≈✦'],
  },
  DBG: {
    stable: ['✦⡶△╲╳╱△⢶╳◆', '·⡶◉╲▿╱◉⢶◆╳', '✦╰╳╲◇╱╳╯⟡·'],
    blink: ['·⡶△╲╳╱△⢶╳◆', '·⡶─╲▿╱─⢶◆╳', '·╰╳╲◇╱╳╯◆·'],
    lift: ['✧⡶△╲◆╱△⢶╳◆', '·⡶◉╲▵╱◉⢶◆╳', '✦╰╳╲◆╱╳╯⟡·'],
    pulse: ['⟡⡶△╲╳╱△⢶╳◆', '◆⡶◉╲▿╱◉⢶◆╳', '·╰╳╲◇╱╳╯✦·'],
  },
  SHIP: {
    stable: ['↗⡴╲∧▸∧╱⢦✦↗', '·⡴╲◉▸◉╱⢦◇▸', '✦╰╲◈▸◈╱╯↗·'],
    blink: ['·⡴╲∧▸∧╱⢦↗✦', '·⡴╲─▸─╱⢦◇▸', '·╰╲◈▸◈╱╯↗·'],
    lift: ['↗⡶╱∧▸∧╲⢶✧↗', '·⡶╱◉▸◉╲⢶◇▸', '✦╰╱◈▸◈╲╯↗·'],
    pulse: ['⟡⡴╲∧▸∧╱⢦↗✦', '↗⡴╲◉▸◉╱⢦◇▸', '·╰╲◈▸◈╱╯✦·'],
  },
  CUR: {
    stable: ['∽⡴◜╭⌾╮◝⢦∽✦', '✦⡴◉╮ᴥ╭◉⢦~□', '·╰╮╰□╯╭╯∽⟡'],
    blink: ['∽⡴◜╭□╮◝⢦∽·', '·⡴─╮ᴥ╭─⢦~□', '·╰╮╰□╯╭╯∽⟡'],
    lift: ['∽⡶◜╭⌾╮◝⢶∽✧', '✧⡶◉╮ᴥ╭◉⢶∽□', '✦╰╮╰◇╯╭╯∽⟡'],
    pulse: ['⟡⡴◜╭⌾╮◝⢦∽✦', '∽⡴◉╮ᴥ╭◉⢦~□', '·╰╮╰□╯╭╯✦⟡'],
  },
  EXP: {
    stable: ['◇⡴╭∪⌕∪╮⢦⌕✦', '·⡴◉╮ᴥ╭◉⢦◇⌕', '✦╰╮╰⌕╯╭╯◆·'],
    blink: ['·⡴╭∪⌕∪╮⢦⌕◇', '·⡴─╮ᴥ╭─⢦◇⌕', '·╰╮╰⌕╯╭╯◆·'],
    lift: ['◇⡶╭∪⌕∪╮⢶⌕✧', '·⡶◉╮△╭◉⢶◇⌕', '✧╰╮╰⌕╯╭╯◆·'],
    pulse: ['⟡⡴╭∪⌕∪╮⢦⌕◆', '◇⡴◉╮ᴥ╭◉⢦◇⌕', '·╰╮╰⌕╯╭╯✦·'],
  },
};

export const INLINE_BUDDY_CREST_INTENT_ART: Partial<Record<SessionIntentTaskKey, InlineBuddyCrestIntentArtwork>> = {
  explore: {
    code: 'EXP',
    stable: ['⌕⡴╭∪⌕∪╮⢦·◇', '·⡴◉╮ᴥ╭◉⢦⌕◇', '✦╰╮╰⌕╯╭╯◇·'],
    blink: ['·⡴╭∪⌕∪╮⢦⌕◇', '·⡴─╮ᴥ╭─⢦⌕◇', '·╰╮╰⌕╯╭╯◇·'],
    lift: ['⌕⡶╭∪⌕∪╮⢶·✧', '·⡶◉╮△╭◉⢶⌕◇', '✧╰╮╰⌕╯╭╯◆·'],
    pulse: ['⟡⡴╭∪⌕∪╮⢦⌕◆', '⌕⡴◉╮ᴥ╭◉⢦◇⌕', '·╰╮╰⌕╯╭╯✦·'],
  },
  project_design: {
    code: 'ARC',
    stable: ['⌂⡴╭∧⌂∧╮⢦┬✦', '·⡴◉╲⌄╱◉⢦╱⌂', '✦⢦╰═⌂═╯⡴⌂·'],
    blink: ['·⡴╭∧⌂∧╮⢦┬◇', '·⡴─╲⌄╱─⢦╱⌂', '·⢦╰═⌂═╯⡴⌂·'],
    lift: ['⌂⡶╭∧⌂∧╮⢶┬✧', '·⡶◉╲⌃╱◉⢶╱⌂', '✧⢶╰═⌂═╯⡶⌂·'],
    pulse: ['⟡⡴╭∧⌂∧╮⢦┬◇', '⌂⡴◉╲⌄╱◉⢦╱⌂', '·⢦╰═⌂═╯⡴✦·'],
  },
  implement: {
    code: 'SHIP',
    stable: ['↗⡴╲∧▸∧╱⢦▣✦', '·⡴╲◉▸◉╱⢦◇▸', '✦╰╲◈▸◈╱╯↗·'],
    blink: ['·⡴╲∧▸∧╱⢦▣✦', '·⡴╲─▸─╱⢦◇▸', '·╰╲◈▸◈╱╯↗·'],
    lift: ['↗⡶╱∧▸∧╲⢶▣✧', '·⡶╱◉▸◉╲⢶◇▸', '✦╰╱◈▸◈╲╯↗·'],
    pulse: ['⟡⡴╲∧▸∧╱⢦▣✦', '↗⡴╲◉▸◉╱⢦◇▸', '·╰╲◈▸◈╱╯✦·'],
  },
  refactor: {
    code: 'VIB',
    stable: ['≈⡶╭╲╽╱╮⢶⋈✦', '·⡶◉╲╽╱◉⢶⋈≈', '✧╰╱╲⋈╱╲╯≈·'],
    blink: ['·⡶╭╲╽╱╮⢶⋈✧', '·⡶─╲╽╱─⢶⋈≈', '·╰╱╲⋈╱╲╯≈✧'],
    lift: ['≈⡶╭╱│╲╮⢶⋈✦', '·⡶◉╱│╲◉⢶⋈≈', '✦╰╲╱⋈╲╱╯≈·'],
    pulse: ['⟡⡶╭╲╽╱╮⢶⋈✧', '≈⡶◉╲╽╱◉⢶⋈≈', '·╰╱╲⋈╱╲╯≈✦'],
  },
  debug: {
    code: 'DBG',
    stable: ['◆⡶△╲╳╱△⢶╳✦', '·⡶◉╲▿╱◉⢶◆╳', '✦╰╳╲◇╱╳╯◆·'],
    blink: ['·⡶△╲╳╱△⢶╳◆', '·⡶─╲▿╱─⢶◆╳', '·╰╳╲◇╱╳╯◆·'],
    lift: ['✧⡶△╲◆╱△⢶╳◆', '·⡶◉╲▵╱◉⢶◆╳', '✦╰╳╲◆╱╳╯⟡·'],
    pulse: ['⟡⡶△╲╳╱△⢶╳◆', '◆⡶◉╲▿╱◉⢶◆╳', '·╰╳╲◇╱╳╯✦·'],
  },
  test_verify: {
    code: 'SHIP',
    stable: ['✓⡴╲∧✓∧╱⢦✓✦', '·⡴╲◉✓◉╱⢦◇✓', '✓╰╲◈▸◈╱╯✦·'],
    blink: ['·⡴╲∧✓∧╱⢦✓✦', '·⡴╲─✓─╱⢦◇✓', '·╰╲◈▸◈╱╯✓·'],
    lift: ['✓⡶╱∧✓∧╲⢶✧✓', '·⡶╱◉✓◉╲⢶◇✓', '✧╰╱◈▸◈╲╯✓·'],
    pulse: ['⟡⡴╲∧✓∧╱⢦✓✦', '✓⡴╲◉✓◉╱⢦◇✓', '·╰╲◈▸◈╱╯✦·'],
  },
  devops: {
    code: 'EXP',
    stable: ['▶⡴╭∪▶∪╮⢦▶✦', '·⡴◉╮ᴥ╭◉⢦▸▶', '▸╰╮╰▶╯╭╯◆·'],
    blink: ['·⡴╭∪▶∪╮⢦▶✦', '·⡴─╮ᴥ╭─⢦▸▶', '▸╰╮╰▶╯╭╯◆·'],
    lift: ['▶⡶╭∪▶∪╮⢶▶✧', '·⡶◉╮△╭◉⢶▸▶', '✧╰╮╰▶╯╭╯◆·'],
    pulse: ['⟡⡴╭∪▶∪╮⢦▶✦', '▶⡴◉╮ᴥ╭◉⢦▸▶', '▸╰╮╰▶╯╭╯✦·'],
  },
  research: {
    code: 'CUR',
    stable: ['□⡴◜╭⌾╮◝⢦∽✦', '✦⡴◉╮ᴥ╭◉⢦∽□', '·╰╮╰□╯╭╯⌾⟡'],
    blink: ['∽⡴◜╭□╮◝⢦⌾·', '·⡴─╮ᴥ╭─⢦∽□', '·╰╮╰□╯╭╯⌾⟡'],
    lift: ['□⡶◜╭⌾╮◝⢶∽✧', '✧⡶◉╮ᴥ╭◉⢶∽□', '✦╰╮╰◇╯╭╯⌾⟡'],
    pulse: ['⟡⡴◜╭⌾╮◝⢦∽✦', '□⡴◉╮ᴥ╭◉⢦∽□', '·╰╮╰□╯╭╯✦⟡'],
  },
};

export function BuddyStrip({ profile, availableWidth, motionFrame, surface = 'panel' }: BuddyStripProps): ReactNode {
  const tuiTheme = useTuiTheme();
  if (!profile) return null;

  const palette = resolveBuddyCrestPalette(profile.code, tuiTheme);
  const presentation = resolveBuddyStripPresentation(profile, availableWidth, motionFrame, surface);
  const backgroundColor = resolveBuddyStripBackgroundColor(motionFrame, tuiTheme.semantic.fill);
  if (!presentation.showAvatar) return null;
  const inline = surface === 'inline';
  const inlineBackgroundColor = resolveBuddyCrestSurfaceBackgroundColor(motionFrame, palette);

  return (
    <box
      style={{
        width: inline ? presentation.avatarColumns : presentation.avatarColumns + 2 + presentation.entryIndent,
        flexDirection: 'row',
        paddingLeft: inline ? 0 : 1 + presentation.entryIndent,
        paddingRight: inline ? 0 : 1,
        paddingTop: inline ? 0 : 1,
        paddingBottom: inline ? 0 : 1,
        marginBottom: inline ? 0 : 1,
        backgroundColor: inline ? inlineBackgroundColor : backgroundColor,
      }}
    >
      <box style={{ width: presentation.avatarColumns, flexShrink: 0, flexDirection: 'column' }}>
        {presentation.avatarRows.map((row, index) => (
          <text key={index} wrapMode="none">
            {Array.from(row).map((char, charIndex) => {
              const tone = resolveBuddyGlyphTone(char);
              const glyphStyle = resolveBuddyGlyphStyle(
                tone,
                palette,
                inline,
                inline ? inlineBackgroundColor : undefined,
                motionFrame,
              );
              return (
                <span
                  key={`${index}-${charIndex}`}
                  fg={glyphStyle.fg}
                  bg={glyphStyle.bg}
                  attributes={glyphStyle.attributes}
                >
                  {char}
                </span>
              );
            })}
          </text>
        ))}
      </box>
    </box>
  );
}

export function resolveBuddyStripPresentation(
  profile: BuddyProfile,
  availableWidth: number,
  motionFrame = 0,
  surface: BuddyStripProps['surface'] = 'panel',
): BuddyStripPresentation {
  const avatar = surface === 'inline'
    ? resolveInlineBuddyCrest(profile.code, motionFrame, profile.intentKey)
    : resolveLineBuddyAvatar(profile.code, motionFrame);
  const avatarColumns = avatar.width;
  const showAvatar = availableWidth >= avatarColumns + 2;
  const entryIndent = Math.max(0, 2 - motionFrame);

  return {
    showAvatar,
    avatarColumns,
    avatarRows: avatar.rows,
    entryIndent,
  };
}

export function resolveBuddyStripBackgroundColor(
  motionFrame: number,
  fill: { grouped: string; elevated: string },
): string {
  return motionFrame <= 1 ? fill.grouped : fill.elevated;
}

export function resolveBuddyCrestPalette(
  code: BuddyProfile['code'],
  theme: ResolvedTuiTheme,
): BuddyCrestPalette {
  const colorway = BUDDY_CREST_COLORWAYS[code];
  return {
    baseBg: theme.modes.statusBar.backgroundColor,
    ...colorway,
  };
}

export function resolveBuddyCrestSurfaceBackgroundColor(
  motionFrame: number,
  palette: BuddyCrestPalette,
): string {
  return resolveBuddyFrameBackgroundColor(motionFrame, palette);
}

export function resolveLineBuddyAvatar(
  code: BuddyProfile['code'],
  motionFrame: number,
): { width: number; rows: readonly string[] } {
  const phase = resolveBuddyCrestMotionPhase(motionFrame);
  const lift = phase === 2 || phase === 4;
  const blink = phase === 1;
  switch (code) {
    case 'ARC':
      return makeLineBuddyRows([
        '  ╭∧──∧╮  ',
        blink ? ' ◜ ─⌄─ ◝ ' : ' ◜ ◉⌄◉ ◝ ',
        '  ╰╮⌂╭╯  ',
        '  ╰─┬─╯  ',
        '  ╱╲ ╱╲  ',
      ]);
    case 'VIB':
      return makeLineBuddyRows([
        lift ? ' ╱◝ ╽ ◜╲ ' : ' ╲◜ ╽ ◝╱ ',
        '  ╲◉╽◉╱  ',
        '  ╲╲╽╱╱  ',
        '  ╱╱╽╲╲  ',
        lift ? ' ╲◜ ╽ ◝╱ ' : ' ╱◝ ╽ ◜╲ ',
      ]);
    case 'DBG':
      return makeLineBuddyRows([
        '  ⌃╲──╱⌃ ',
        blink ? ' ╱ ─▿─ ╲' : ' ╱ ◉▿◉ ╲',
        ' ╲ ◇╳◇ ╱',
        '  ╲╳╳╱  ',
        '  ╱╲ ╱╲  ',
      ]);
    case 'SHIP':
      return makeLineBuddyRows([
        '   ↗╱╲   ',
        lift ? ' ╱∧╱ ╲∧╲ ' : ' ╲∨╲ ╱∨╱ ',
        ' ╲╲ ◈ ╱╱ ',
        '  ╲╲╱╱  ',
        ' ╱╲  ╱╲ ',
      ]);
    case 'CUR':
      return makeLineBuddyRows([
        lift ? '  ∽∽~~   ' : '  ∽∽∽~~  ',
        blink ? ' ◜─╮╭╮  ' : ' ◜◉╮╭╮  ',
        ' ╰∪╯╰╮ ',
        ' ╭╯╲╱╰╮',
        ' □╱   ~ ',
      ]);
    case 'EXP':
      return makeLineBuddyRows([
        ' ╭∪──∪╮ ',
        blink ? '  │─ᴥ─│  ' : '  │◉ᴥ◉│  ',
        '  ╰┬⌕┬╯  ',
        '  ╱╲ ╱╲  ',
        ' ╱╱   ╲╲ ',
      ]);
  }
}

function makeLineBuddyRows(rows: readonly string[]): { width: number; rows: readonly string[] } {
  return {
    width: TIMELINE_BUDDY_COLUMNS,
    rows: rows.map((row) => row.slice(0, TIMELINE_BUDDY_COLUMNS).padEnd(TIMELINE_BUDDY_COLUMNS, ' ')),
  };
}

export function resolveInlineBuddyCrest(
  code: BuddyProfile['code'],
  motionFrame: number,
  intentKey?: string,
): { width: number; rows: readonly string[] } {
  const phase = resolveBuddyCrestMotionPhase(motionFrame);
  const lift = phase === 2 || phase === 4;
  const blink = phase === 1;
  const pulse = phase === 3 || phase === 5;
  const artwork = resolveInlineBuddyCrestArtwork(code, intentKey);
  const row = blink && artwork.blink
    ? artwork.blink
    : lift && artwork.lift
      ? artwork.lift
      : pulse && artwork.pulse
        ? artwork.pulse
        : artwork.stable;

  return makeInlineBuddyRows(row, motionFrame);
}

function resolveInlineBuddyCrestArtwork(
  code: BuddyProfile['code'],
  intentKey?: string,
): InlineBuddyCrestArtwork {
  const normalizedIntent = normalizeSessionIntentKey(intentKey ?? '');
  const intentArtwork = INLINE_BUDDY_CREST_INTENT_ART[normalizedIntent as SessionIntentTaskKey];
  return intentArtwork?.code === code ? intentArtwork : INLINE_BUDDY_CREST_ART[code];
}

export function resolveBuddyCrestPreviewRows(
  codes: readonly BuddyProfile['code'][] = BUDDY_TYPE_CODES,
): readonly string[] {
  return codes.map((code) => {
    const design = BUDDY_CREST_DESIGN[code];
    const frames = BUDDY_CREST_PREVIEW_MOTION_FRAMES
      .map((motionFrame) => resolveInlineBuddyCrest(code, motionFrame).rows.join('/'))
      .join(' ');

    return `${code} ${design.animal.padEnd(9)} ${design.intentSignal.padEnd(12)} ${frames}`;
  });
}

function makeInlineBuddyRows(rows: readonly string[], motionFrame: number): { width: number; rows: readonly string[] } {
  void motionFrame;
  return {
    width: INTENT_BUDDY_COLUMNS,
    rows: rows.map((row) => centerPadOrTrimDisplayWidth(row.trim(), INTENT_BUDDY_COLUMNS)),
  };
}

export function resolveInlineBuddyCrestFiller(motionFrame: number): string {
  void motionFrame;
  return ' ';
}

function trimDisplayWidth(row: string, columns: number): string {
  let out = '';
  for (const ch of row) {
    if (lineDisplayWidth(out + ch) > columns) break;
    out += ch;
  }
  return out;
}

function centerPadOrTrimDisplayWidth(row: string, columns: number): string {
  const trimmed = trimDisplayWidth(row, columns);
  const remaining = Math.max(0, columns - lineDisplayWidth(trimmed));
  const left = Math.floor(remaining / 2);
  const right = remaining - left;
  return `${' '.repeat(left)}${trimmed}${' '.repeat(right)}`;
}

export function resolveBuddyGlyphTone(char: string): BuddyGlyphTone {
  if (BUDDY_GLYPH_TONE_CHARACTERS.frame.includes(char)) return 'frame';
  if (BUDDY_GLYPH_TONE_CHARACTERS.eye.includes(char)) return 'eye';
  if (BUDDY_GLYPH_TONE_CHARACTERS.spark.includes(char)) return 'spark';
  if (BUDDY_GLYPH_TONE_CHARACTERS.accent.includes(char)) return 'accent';
  return 'outline';
}

export function resolveBuddyGlyphAttributes(tone: BuddyGlyphTone): number {
  switch (tone) {
    case 'eye':
    case 'spark':
      return TextAttributes.BOLD;
    case 'frame':
    case 'accent':
    case 'outline':
      return TextAttributes.NONE;
  }
}

export function resolveBuddyGlyphBackgroundColor(
  tone: BuddyGlyphTone,
  palette: BuddyCrestPalette,
  inline: boolean,
  inlineBackgroundColor?: string,
  motionFrame = 0,
): string | undefined {
  if (!inline) return undefined;
  switch (tone) {
    case 'frame':
      return resolveBuddyFrameBackgroundColor(motionFrame, palette);
    case 'eye':
    case 'spark':
      return palette.focusBg;
    case 'accent':
    case 'outline':
      return inlineBackgroundColor;
  }
}

export function resolveBuddyGlyphStyle(
  tone: BuddyGlyphTone,
  palette: BuddyCrestPalette,
  inline: boolean,
  inlineBackgroundColor?: string,
  motionFrame = 0,
): BuddyGlyphStyle {
  return {
    fg: colorForBuddyGlyphTone(tone, palette),
    bg: resolveBuddyGlyphBackgroundColor(tone, palette, inline, inlineBackgroundColor, motionFrame),
    attributes: resolveBuddyGlyphAttributes(tone),
  };
}

export function resolveBuddyFrameBackgroundColor(
  motionFrame: number,
  palette: BuddyCrestPalette,
): string {
  const phase = resolveBuddyCrestMotionPhase(motionFrame);
  return phase === 3 || phase === 5 ? palette.alternateBg : palette.frameBg;
}

function colorForBuddyGlyphTone(
  tone: BuddyGlyphTone,
  palette: BuddyCrestPalette,
): string {
  switch (tone) {
    case 'eye':
      return palette.eyeFg;
    case 'spark':
      return palette.sparkFg;
    case 'frame':
      return palette.frameFg;
    case 'accent':
      return palette.accentFg;
    case 'outline':
      return palette.outlineFg;
  }
}
