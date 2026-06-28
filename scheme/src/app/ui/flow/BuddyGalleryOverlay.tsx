import type { ReactNode } from 'react';
import type { BuddyTypeCode } from '../../observer/view-model/buddy-profile';
import { truncateFlowText } from '../../../utils/flow-text';
import { useTuiTheme } from '../theme';
import { getObserverMessages, type ObserverMessages } from '../i18n/observer-messages';
import { flowSpacing } from './flow-ui/flow-spacing';
import {
  getPixelBuddySpriteDimensions,
  PixelBuddySprite,
  PIXEL_BUDDY_CODES,
  resolvePixelBuddyMotionPhase,
  resolvePixelBuddyMotionStep,
  resolvePixelBuddyPalette,
} from './PixelBuddySprite';
import {
  resolveBuddyCrestPalette,
  resolveBuddyGlyphStyle,
  resolveBuddyGlyphTone,
  resolveInlineBuddyCrest,
} from './BuddyStrip';

const GALLERY_SPARK_FRAMES = ['✦', '·', '✧', '·'] as const;
const GALLERY_ORBIT_FRAMES = ['· ✦ ·', '✧ · ·', '· · ✦', '· ✧ ·'] as const;
const HERO_SPRITE_COLUMNS = getPixelBuddySpriteDimensions('hero').width;
const HERO_LABEL_GUTTER = 4;

export interface BuddyGalleryLayout {
  columns: number;
  cardGap: number;
  cardWidth: number;
  labelWidth: number;
  pageSize: number;
  pageCount: number;
}

export interface BuddyGalleryPage {
  page: number;
  pageCount: number;
  startIndex: number;
  endIndex: number;
  codes: readonly BuddyTypeCode[];
}

export interface BuddyAnimalSignal {
  glyph: string;
  identity: string;
  settingLine: string;
}

export interface BuddyGalleryPresentation {
  title: string;
  intro: string;
}

export interface BuddyGalleryCrestPresentation {
  label: string;
  rows: readonly string[];
}

interface BuddyGalleryOverlayProps {
  motionFrame: number;
  availableWidth: number;
  page: number;
}

export function BuddyGalleryOverlay({ motionFrame, availableWidth, page }: BuddyGalleryOverlayProps): ReactNode {
  const theme = useTuiTheme();
  const messages = getObserverMessages();
  const { columns, cardGap, cardWidth, labelWidth, pageSize } = resolveBuddyGalleryLayout(availableWidth);
  const pageWindow = resolveBuddyGalleryPage(PIXEL_BUDDY_CODES, pageSize, page);
  const rows = chunkBuddyCodes(pageWindow.codes, columns);
  const orbit = GALLERY_ORBIT_FRAMES[motionFrame % GALLERY_ORBIT_FRAMES.length] ?? GALLERY_ORBIT_FRAMES[0];

  return (
    <box
      style={{
        width: '100%',
        flexShrink: 0,
        flexDirection: 'column',
        backgroundColor: theme.semantic.fill.elevated,
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 1,
        paddingBottom: 1,
        border: ['top'],
        borderColor: theme.semantic.separator,
        borderStyle: 'single',
      }}
    >
      <text wrapMode="none">
        <span fg={theme.semantic.tint}>{messages.buddyGalleryTitle}</span>
        <span fg={theme.semantic.label.quaternary}>{' '}</span>
        <span fg={theme.semantic.warning}>{orbit}</span>
        <span fg={theme.semantic.label.quaternary}>{` · page ${pageWindow.page + 1}/${pageWindow.pageCount}`}</span>
        <span fg={theme.semantic.label.quaternary}>{` · ${messages.buddyGalleryHint}`}</span>
      </text>
      <text wrapMode="none" fg={theme.semantic.label.quaternary}>
        {messages.buddyGalleryCount(PIXEL_BUDDY_CODES.length, pageWindow.startIndex + 1, pageWindow.endIndex)}
      </text>
      <box style={{ flexDirection: 'column', marginTop: 1 }}>
        {rows.map((row, rowIndex) => (
          <box key={rowIndex} style={{ flexDirection: 'row', marginBottom: rowIndex === rows.length - 1 ? 0 : 1 }}>
            {row.map((code, columnIndex) => {
              const palette = resolvePixelBuddyPalette(code, theme);
              const spark = GALLERY_SPARK_FRAMES[(motionFrame + PIXEL_BUDDY_CODES.indexOf(code)) % GALLERY_SPARK_FRAMES.length];
              const signal = resolveBuddyAnimalSignal(code, motionFrame, messages);
              const presentation = resolveBuddyGalleryPresentation(code, motionFrame, labelWidth, messages);
              const crestPalette = resolveBuddyCrestPalette(code, theme);
              const crest = resolveBuddyGalleryCrestPresentation(code, motionFrame, messages);
              return (
                <box
                  key={code}
                  style={{
                    width: cardWidth,
                    flexDirection: 'row',
                    marginRight: columnIndex === row.length - 1 ? 0 : cardGap,
                    backgroundColor: theme.semantic.fill.grouped,
                    border: ['top', 'bottom', 'left', 'right'],
                    borderColor: resolveBuddyAnimalBorderColor(code, motionFrame, palette),
                    borderStyle: 'single',
                    paddingLeft: 1,
                    paddingRight: 1,
                    paddingTop: 1,
                    paddingBottom: 1,
                  }}
                >
                  <PixelBuddySprite code={code} motionFrame={motionFrame} size="hero" />
                  <box style={{ flexDirection: 'column', marginLeft: 1, justifyContent: 'center' }}>
                    <text wrapMode="none">
                      <span fg={palette.w}>{signal.glyph}</span>
                      <span fg={theme.semantic.label.quaternary}>{' '}</span>
                      <span fg={palette.m}>{code}</span>
                      <span fg={theme.semantic.label.quaternary}>{' · '}</span>
                      <span fg={theme.semantic.label.primary}>{presentation.title}</span>
                      <span fg={theme.semantic.label.quaternary}>{' · '}</span>
                      <span fg={palette.w}>{spark}</span>
                    </text>
                    <text wrapMode="none">
                      <span fg={theme.semantic.label.quaternary}>{`${messages.buddyIntroLabel} · `}</span>
                      <span fg={theme.semantic.label.primary}>{presentation.intro}</span>
                    </text>
                    {crest.rows.map((crestRow, crestRowIndex) => (
                      <text key={`${code}-crest-${crestRowIndex}`} wrapMode="none">
                        <span fg={theme.semantic.label.quaternary}>
                          {crestRowIndex === 0 ? crest.label : '        '}
                        </span>
                        {Array.from(crestRow).map((char, charIndex) => {
                          const tone = resolveBuddyGlyphTone(char);
                          const style = resolveBuddyGlyphStyle(tone, crestPalette, false);
                          return (
                            <span
                              key={`${code}-crest-${crestRowIndex}-${charIndex}`}
                              fg={style.fg}
                              attributes={style.attributes}
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
            })}
          </box>
        ))}
      </box>
    </box>
  );
}

export function resolveBuddyGalleryLayout(
  availableWidth: number,
  totalCount = PIXEL_BUDDY_CODES.length,
): BuddyGalleryLayout {
  const contentWidth = Math.max(40, availableWidth - flowSpacing.chromePadX * 2);
  const columns = contentWidth >= 186 ? 3 : contentWidth >= 122 ? 2 : 1;
  const cardGap = columns > 1 ? 2 : 0;
  const pageSize = columns * 2;
  const minCardWidth = HERO_SPRITE_COLUMNS + 24;
  const cardWidth = columns === 1
    ? Math.max(minCardWidth, Math.min(104, contentWidth))
    : Math.max(minCardWidth, Math.floor((contentWidth - cardGap * (columns - 1)) / columns));
  return {
    columns,
    cardGap,
    cardWidth,
    labelWidth: Math.max(18, cardWidth - HERO_SPRITE_COLUMNS - HERO_LABEL_GUTTER),
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export function resolveBuddyGalleryPage(
  codes: readonly BuddyTypeCode[],
  pageSize: number,
  page: number,
): BuddyGalleryPage {
  const safePageSize = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(codes.length / safePageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const startIndex = safePage * safePageSize;
  const endIndex = Math.min(codes.length, startIndex + safePageSize);
  return {
    page: safePage,
    pageCount,
    startIndex,
    endIndex,
    codes: codes.slice(startIndex, endIndex),
  };
}

function chunkBuddyCodes(codes: readonly BuddyTypeCode[], size: number): readonly BuddyTypeCode[][] {
  const rows: BuddyTypeCode[][] = [];
  for (let index = 0; index < codes.length; index += size) {
    rows.push(codes.slice(index, index + size));
  }
  return rows;
}

export function resolveBuddyGalleryCrestPresentation(
  code: BuddyTypeCode,
  motionFrame: number,
  messages: ObserverMessages = getObserverMessages(),
): BuddyGalleryCrestPresentation {
  return {
    label: `${messages.buddyCrestLabel} · `,
    rows: resolveInlineBuddyCrest(code, motionFrame).rows,
  };
}

export function resolveBuddyGalleryPresentation(
  code: BuddyTypeCode,
  motionFrame: number,
  labelWidth: number,
  messages: ObserverMessages = getObserverMessages(),
): BuddyGalleryPresentation {
  const label = messages.buddyProfiles[code];
  const signal = resolveBuddyAnimalSignal(code, motionFrame, messages);
  const titleWidth = Math.max(6, labelWidth);
  const introWidth = Math.max(6, labelWidth - 8);

  return {
    title: truncateFlowText(`${signal.identity} · ${label.persona}`, titleWidth),
    intro: truncateFlowText(label.intro, introWidth),
  };
}

export function resolveBuddySignature(
  code: BuddyTypeCode,
  motionFrame: number,
  messages: ObserverMessages = getObserverMessages(),
): string {
  void motionFrame;
  const label = messages.buddyProfiles[code];
  switch (code) {
    case 'ARC':
    case 'VIB':
    case 'DBG':
    case 'SHIP':
    case 'CUR':
    case 'EXP':
      return `${label.identity} · ${label.persona}`;
  }
}

export function resolveBuddyAnimalSignal(
  code: BuddyTypeCode,
  motionFrame: number,
  messages: ObserverMessages = getObserverMessages(),
): BuddyAnimalSignal {
  const phase = resolvePixelBuddyMotionPhase(motionFrame);
  const lift = phase === 2 || phase === 4;
  const pulse = phase === 3 || phase === 5;
  const label = messages.buddyProfiles[code];
  switch (code) {
    case 'ARC':
      return {
        glyph: pulse ? '✶' : '⌂',
        identity: label.identity,
        settingLine: label.setting,
      };
    case 'VIB':
      return {
        glyph: lift ? '✦' : '⋈',
        identity: label.identity,
        settingLine: label.setting,
      };
    case 'DBG':
      return {
        glyph: phase === 1 ? '⌁' : '◇',
        identity: label.identity,
        settingLine: label.setting,
      };
    case 'SHIP':
      return {
        glyph: lift ? '↗' : '≋',
        identity: label.identity,
        settingLine: label.setting,
      };
    case 'CUR':
      return {
        glyph: pulse ? '✧' : '□',
        identity: label.identity,
        settingLine: label.setting,
      };
    case 'EXP':
      return {
        glyph: lift ? '⌾' : '⌖',
        identity: label.identity,
        settingLine: label.setting,
      };
  }
}

function resolveBuddyAnimalBorderColor(
  code: BuddyTypeCode,
  motionFrame: number,
  palette: ReturnType<typeof resolvePixelBuddyPalette>,
): string {
  const index = PIXEL_BUDDY_CODES.indexOf(code);
  const phase = resolvePixelBuddyMotionPhase(motionFrame);
  return phase !== 0 && resolvePixelBuddyMotionStep(motionFrame) % PIXEL_BUDDY_CODES.length === index ? palette.o : palette.s;
}
