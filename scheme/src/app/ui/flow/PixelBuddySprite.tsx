import {
  parseColor,
  Renderable,
  RGBA,
  type OptimizedBuffer,
  type RenderableOptions,
  type RenderContext,
} from '@opentui/core';
import { extend } from '@opentui/react';
import type { ReactNode } from 'react';
import { BUDDY_TYPE_CODES, type BuddyTypeCode } from '../../observer/view-model/buddy-profile';
import { useTuiTheme } from '../theme';
import type { ResolvedTuiTheme } from '../themes/resolved-theme';

type PixelToken = '.' | 'g' | 's' | 'm' | 'o' | 'a' | 'h' | 'e' | 'w';
type PixelFrame = readonly string[];
type LogicalSprite = readonly string[];
type PixelCanvas = PixelToken[][];
type BuddyAvatarPalette = Record<PixelToken, string>;
type BuddyRolePalette = Pick<BuddyAvatarPalette, 's' | 'm' | 'o' | 'a' | 'h' | 'e' | 'w'>;
type BuddySpriteSize = 'compact' | 'hero';
export type PixelBuddyMotionPhase = 0 | 1 | 2 | 3 | 4 | 5;

interface BuddyCell {
  char: string;
  fg: RGBA;
  bg: RGBA;
}

interface Point {
  x: number;
  y: number;
}

interface SpriteDimensions {
  width: number;
  height: number;
}

interface LumaMark {
  beacon: Point;
  core: Point;
}

export const PIXEL_BUDDY_CODES = BUDDY_TYPE_CODES;

const PIXEL_EMPTY: PixelToken = '.';
const SOURCE_WIDTH = 56;
const SOURCE_HEIGHT = 56;
const LOGICAL_WIDTH = 28;
const LOGICAL_HEIGHT = 28;
const HERO_DIMENSIONS: SpriteDimensions = { width: 36, height: 18 };
const COMPACT_DIMENSIONS: SpriteDimensions = { width: 20, height: 10 };
const CELL_SOURCE_WIDTH = SOURCE_WIDTH / LOGICAL_WIDTH;
const CELL_SOURCE_HEIGHT = SOURCE_HEIGHT / LOGICAL_HEIGHT;
const MOTION_SEQUENCE = [0, 0, 1, 0, 2, 4, 2, 0, 3, 5, 3, 0, 1, 0, 2, 0] as const satisfies readonly PixelBuddyMotionPhase[];
const TRANSPARENT = RGBA.fromValues(0, 0, 0, 0);
const LUMA_MARKS: Record<BuddyTypeCode, LumaMark> = {
  ARC: { beacon: { x: 14, y: 6 }, core: { x: 14, y: 19 } },
  VIB: { beacon: { x: 14, y: 6 }, core: { x: 14, y: 17 } },
  DBG: { beacon: { x: 14, y: 8 }, core: { x: 14, y: 18 } },
  SHIP: { beacon: { x: 14, y: 7 }, core: { x: 14, y: 15 } },
  CUR: { beacon: { x: 11, y: 7 }, core: { x: 11, y: 19 } },
  EXP: { beacon: { x: 14, y: 7 }, core: { x: 14, y: 21 } },
};
const BUDDY_ROLE_PALETTES: Record<BuddyTypeCode, BuddyRolePalette> = {
  ARC: {
    s: '#3f4b6a',
    m: '#6fb8ff',
    o: '#67e8f9',
    a: '#a78bfa',
    h: '#dbeafe',
    e: '#0b1020',
    w: '#f7c948',
  },
  VIB: {
    s: '#46506d',
    m: '#67e8f9',
    o: '#f7c948',
    a: '#a78bfa',
    h: '#eef2ff',
    e: '#0b1020',
    w: '#f7c948',
  },
  DBG: {
    s: '#4b4146',
    m: '#f87171',
    o: '#f7c948',
    a: '#ef4444',
    h: '#ffedd5',
    e: '#0b1020',
    w: '#fbbf24',
  },
  SHIP: {
    s: '#46506d',
    m: '#7dd3fc',
    o: '#67e8f9',
    a: '#86efac',
    h: '#e0f2fe',
    e: '#0b1020',
    w: '#f7c948',
  },
  CUR: {
    s: '#5b3a2e',
    m: '#c77b30',
    o: '#f2a93b',
    a: '#5eead4',
    h: '#ffe2b7',
    e: '#0b1020',
    w: '#f7c948',
  },
  EXP: {
    s: '#46506d',
    m: '#93c5fd',
    o: '#7dd3fc',
    a: '#a78bfa',
    h: '#f8fafc',
    e: '#0b1020',
    w: '#f7c948',
  },
};
const BUDDY_BASE_SPRITES: Record<BuddyTypeCode, LogicalSprite> = {
  ARC: [
    '............................',
    '.........ss......ss.........',
    '........smmss..ssmms........',
    '.......smmmmssssmmmms.......',
    '......smmhhhhhhhhhhmms......',
    '.....smmhhhhswwshhhhmmms....',
    '....smmhhhhehwwhehhhmmms....',
    '...smmhhhhhhhwwhhhhhhmmms...',
    '...smmhhhehhhhhhhhehhhmmms..',
    '..smmhhhhhhhoohhhhhhhmmms...',
    '..smaahhhhhhhhhhhhhhaamms...',
    '..smaaahhhwwwwwwhhhaaamms...',
    '...smaaahhhoooohhhaaamms....',
    '...ssmaaahhhoohhhaaamss.....',
    '....smmmaaaaaaaaammmss......',
    '.....smmmmmooooommms........',
    '......smmmoowooommss........',
    '.......ssmmmmmmmmss.........',
    '.........ssmmmmss...........',
    '..........ssooss............',
    '.........sso..oss...........',
    '........ss......ss..........',
  ],
  VIB: [
    '............ss..............',
    '......ss....ss....ss........',
    '....ssaass..mm..ssaass......',
    '...saaaoosmmmmsssooaaas.....',
    '..saaaaoohmhhmhhooaaaas.....',
    '.saaaooohhheehhhoooaaas....',
    '.saaaoohhhhhhhhhhooaaas.....',
    'saaaaoohhwwwmwwwhhooaaas....',
    'saaaaoohhwmmmmwwhhooaaas....',
    '.saaaohhhwmmmmwwhhhoaas.....',
    '..saaahhhmmhhmmhhhaas......',
    '...saahhmmmhhmmmhhaas......',
    '....sshhmmmmmmmmhhss.......',
    '.....smmmmmmmmmmmmss.......',
    '....saaahhhmmmmhhhaaass....',
    '...saaaoohhmmmmhhooaaas....',
    '..saaaoooohmmhhooooaaas....',
    '...ssaaaoossmmssaaass......',
    '.....ssss..ssss..ssss......',
    '............ss..............',
    '...........s..s.............',
    '..........s....s............',
  ],
  DBG: [
    '.........ss........ss.......',
    '........smmss....ssmms......',
    '.......smmmwss..sswmmms.....',
    '......smmmooossssooomms.....',
    '.....smmmoooooowooooomms....',
    '....smmmoohhhhhwhhoooomms...',
    '...smmmooheehhheehhoooomms..',
    '...smmmoohhhhhhhhhhoooomms..',
    '....smmmooohhwwwhhoooomms...',
    '.....smmmooooeeeoooomms.....',
    '......smmmmhhhhhhmmmss......',
    '.......ssmmmmmmmmss.........',
    '....ss...ssmmmmss......sss..',
    '...smmss..smmmms.....ssomms.',
    '..smooomssssmmmssssssmooomms',
    '.smooooowmmsssssmmwooooomms',
    '..smoooowmmmmmmmmwoooooms..',
    '...ssmoooowmmmmwooooomss...',
    '.....ssmmoooowoooommss.....',
    '.......ssssmmmmssss........',
    '.........s..ss..s..........',
    '........ss......ss.........',
  ],
  SHIP: [
    '............ss..............',
    '...........swws.............',
    '..........smmmms............',
    '.........smmhhmms...........',
    '....sssssmmhehmms.....ss....',
    '..ssaaaammmhhhmmmsssssaaas..',
    '.saaaaoohmmmmmmmhooooaaaas..',
    'saaaaoooohmmmmmhhooooaaaas..',
    '.saaaaoooohmmmhhooooaaaas...',
    '..ssaaaaoohhhhooooaaass.....',
    '....sssaaahhhhooaaass.......',
    '.......sshhhhhhss...........',
    '.......smmmwwmmms...........',
    '......smmmoooommms..........',
    '.....smmmmooooommmms........',
    '....smmmsssooosssmmms.......',
    '...smmss...ss...ssmms.......',
    '..ss.......ss.......ss......',
    '..........ssss..............',
    '.........ss..ss.............',
    '........ss....ss............',
    '.......ss......ss...........',
  ],
  CUR: [
    '.................ssss.......',
    '...............ssaaaass.....',
    '..............saaaaaoos.....',
    '.............saaaaoooos.....',
    '............saaaaoohhhs.....',
    '...........saaaaoohhhhs.....',
    '.........ssaaaaoohhmmms.....',
    '........smmssaoohhmmms......',
    '......ssmmmmmsshhmmms.......',
    '.....smmmwwmmmssmmms........',
    '....smmmmmwwmmmmmms.........',
    '....smmmmhhehhmmmms.........',
    '...smmmhhhhehhhmmms.........',
    '...smmhhhhhhhhhmms..........',
    '..smmhhhooohhhmms...........',
    '..smmhhoowooohms............',
    '..smmhhoooooohms............',
    '...smmhhhhhhmms.............',
    '....smmmmmmmss......sss.....',
    '.....smmmmmss.....sswws.....',
    '.....ssooss.....sswwhhs.....',
    '.....ss..ss....swwhhss......',
    '....ss....ss....ssss........',
  ],
  EXP: [
    '........ssssssssssss........',
    '......ssmmmmmmmmmmmmss......',
    '.....saaammmmmmmmmmaaas.....',
    '....saaaamhhhhhhhhmaaaas....',
    '...saaaamhhhhhhhhhhmaaass...',
    '...saaammhhhehhhehhhmmass...',
    '..saaammhhhhhhhhhhhhmmmas...',
    '..saaammmhhhwwhhhhhhmmmas...',
    '...saammmhhhoooohhhmmmas....',
    '....smmmhhhooeeoohhmmms.....',
    '.....smmmhhheeehhhmmms......',
    '......smmmmhhhhhhmmmss......',
    '.......smmmmmmmmmmss........',
    '........smmmwwwmmms.........',
    '.......smmmmoooommms........',
    '......smmmmooooowmmms.......',
    '.....smmsssooossssmms.......',
    '....ss.......s.....ss.......',
    '...ss........s......ss......',
    '...s.........s.......s......',
    '...........ssssss...........',
    '..........swwwwwws..........',
  ],
};

interface BuddyAvatarRenderableOptions extends RenderableOptions<BuddyAvatarRenderable> {
  code?: BuddyTypeCode;
  motionFrame?: number;
  avatarSize?: BuddySpriteSize;
  palette?: BuddyAvatarPalette;
  backgroundColor?: string;
}

class BuddyAvatarRenderable extends Renderable {
  private _code: BuddyTypeCode = 'ARC';
  private _motionFrame = 0;
  private _avatarSize: BuddySpriteSize = 'compact';
  private _palette: BuddyAvatarPalette = defaultBuddyPalette();
  private _backgroundColor = 'transparent';

  constructor(ctx: RenderContext, options: BuddyAvatarRenderableOptions) {
    const dimensions = resolveSpriteDimensions(options.avatarSize ?? 'compact');
    super(ctx, {
      ...options,
      width: options.width ?? dimensions.width,
      height: options.height ?? dimensions.height,
    });
    this._code = options.code ?? 'ARC';
    this._motionFrame = options.motionFrame ?? 0;
    this._avatarSize = options.avatarSize ?? 'compact';
    this._palette = options.palette ?? defaultBuddyPalette();
    this._backgroundColor = options.backgroundColor ?? 'transparent';
  }

  get code(): BuddyTypeCode {
    return this._code;
  }

  set code(value: BuddyTypeCode | null | undefined) {
    const next = value ?? 'ARC';
    if (this._code === next) return;
    this._code = next;
    this.requestRender();
  }

  get motionFrame(): number {
    return this._motionFrame;
  }

  set motionFrame(value: number | null | undefined) {
    const next = value ?? 0;
    if (this._motionFrame === next) return;
    this._motionFrame = next;
    this.requestRender();
  }

  get avatarSize(): BuddySpriteSize {
    return this._avatarSize;
  }

  set avatarSize(value: BuddySpriteSize | null | undefined) {
    const next = value ?? 'compact';
    if (this._avatarSize === next) return;
    this._avatarSize = next;
    this.requestRender();
  }

  get palette(): BuddyAvatarPalette {
    return this._palette;
  }

  set palette(value: BuddyAvatarPalette | null | undefined) {
    if (!value) return;
    this._palette = value;
    this.requestRender();
  }

  get backgroundColor(): string {
    return this._backgroundColor;
  }

  set backgroundColor(value: string | null | undefined) {
    const next = value ?? 'transparent';
    if (this._backgroundColor === next) return;
    this._backgroundColor = next;
    this.requestRender();
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    const dimensions = resolveSpriteDimensions(this._avatarSize);
    const logicalRows = resolvePixelBuddyDisplayFrame(this._code, this._motionFrame, this._avatarSize);
    const palette = parsePalette(this._palette);
    const background = toRgba(this._backgroundColor);

    for (let y = 0; y < dimensions.height; y += 1) {
      const top = parsePixelRow(logicalRows[y * 2], dimensions.width);
      const bottom = parsePixelRow(logicalRows[y * 2 + 1], dimensions.width);
      for (let x = 0; x < dimensions.width; x += 1) {
        const cell = resolveHalfBlockCell(top[x], bottom[x], palette, background);
        buffer.setCell(this.x + x, this.y + y, cell.char, cell.fg, cell.bg);
      }
    }
  }
}

let avatarRenderableRegistered = false;

function ensureBuddyAvatarRenderableRegistered(): void {
  if (avatarRenderableRegistered) return;
  extend({ 'buddy-avatar': BuddyAvatarRenderable });
  avatarRenderableRegistered = true;
}

declare module '@opentui/react' {
  interface OpenTUIComponents {
    'buddy-avatar': typeof BuddyAvatarRenderable;
  }
}

export interface PixelBuddySpriteProps {
  code: BuddyTypeCode;
  motionFrame: number;
  size?: BuddySpriteSize;
}

export function PixelBuddySprite({ code, motionFrame, size = 'compact' }: PixelBuddySpriteProps): ReactNode {
  ensureBuddyAvatarRenderableRegistered();
  const theme = useTuiTheme();
  const palette = resolvePixelBuddyPalette(code, theme);
  const dimensions = resolveSpriteDimensions(size);

  return (
    <buddy-avatar
      code={code}
      motionFrame={motionFrame}
      avatarSize={size}
      palette={palette}
      backgroundColor={theme.semantic.fill.grouped}
      style={{ width: dimensions.width, height: dimensions.height, flexShrink: 0 }}
    />
  );
}

export function resolvePixelBuddyFrame(code: BuddyTypeCode, motionFrame: number): PixelFrame {
  return expandLogicalSprite(resolveAvatarPixels(code, motionFrame));
}

export function resolvePixelBuddyDisplayFrame(
  code: BuddyTypeCode,
  motionFrame: number,
  size: BuddySpriteSize,
): readonly string[] {
  const dimensions = resolveSpriteDimensions(size);
  const frame = sampleSprite(resolveAvatarPixels(code, motionFrame), dimensions.width, dimensions.height * 2);
  return size === 'hero'
    ? decorateHeroDisplayFrame(code, motionFrame, frame)
    : decorateCompactDisplayFrame(code, motionFrame, frame);
}

export function getPixelBuddySpriteDimensions(size: BuddySpriteSize): SpriteDimensions {
  return { ...resolveSpriteDimensions(size) };
}

export function getPixelBuddyFrameCount(code: BuddyTypeCode): number {
  void code;
  return MOTION_SEQUENCE.length;
}

export function resolvePixelBuddyMotionStep(motionFrame: number): number {
  return Math.abs(motionFrame) % MOTION_SEQUENCE.length;
}

export function resolvePixelBuddyMotionPhase(motionFrame: number): PixelBuddyMotionPhase {
  return MOTION_SEQUENCE[resolvePixelBuddyMotionStep(motionFrame)] ?? 0;
}

function resolveSpriteDimensions(size: BuddySpriteSize): SpriteDimensions {
  return size === 'hero' ? HERO_DIMENSIONS : COMPACT_DIMENSIONS;
}

function resolveAvatarPixels(code: BuddyTypeCode, motionFrame: number): LogicalSprite {
  const beat = resolvePixelBuddyMotionStep(motionFrame);
  const phase = resolvePixelBuddyMotionPhase(motionFrame);
  const canvas = createCanvas();
  const bob = isLiftPhase(phase) ? -1 : 0;
  const blink = phase === 1;
  const pulse = isPulsePhase(phase);

  drawRoleHalo(canvas, code, pulse);
  drawAmbientSparkles(canvas, code, pulse);
  drawBuddyHabitat(canvas, code, pulse, beat);
  switch (code) {
    case 'VIB':
      drawButterflyDirector(canvas, bob, blink, pulse);
      break;
    case 'DBG':
      drawBreakpointFox(canvas, bob, blink, pulse);
      break;
    case 'SHIP':
      drawSeaSwallowShipper(canvas, bob, blink, pulse);
      break;
    case 'CUR':
      drawSquirrelCurator(canvas, bob, blink, pulse);
      break;
    case 'EXP':
      drawTrailDog(canvas, bob, blink, pulse);
      break;
    case 'ARC':
    default:
      drawOwlArchitect(canvas, bob, blink, pulse);
      break;
  }
  drawAnimalFinishingDetails(canvas, code, bob, pulse, phase, beat);
  drawAnimalAccessoryLayer(canvas, code, bob, pulse, phase, beat);
  drawLumaIdentityLayer(canvas, code, phase);
  applySpriteDepth(canvas);
  drawRoleMotionAccent(canvas, code, phase, beat);
  return canvas.map((row) => row.join(''));
}

function drawRoleHalo(canvas: PixelCanvas, code: BuddyTypeCode, pulse: boolean): void {
  drawDitheredEllipseRing(canvas, 14, 14, 12, 12, PIXEL_BUDDY_CODES.indexOf(code) * 3, pulse ? 'o' : 's');
  drawDitheredEllipseRing(canvas, 14, 14, 10, 10, PIXEL_BUDDY_CODES.indexOf(code), 'g');
  switch (code) {
    case 'ARC':
      drawLine(canvas, 5, 22, 23, 22, pulse ? 'w' : 'o');
      drawLine(canvas, 8, 24, 20, 24, 'g');
      break;
    case 'VIB':
      drawLine(canvas, 2, 8, 8, 5, pulse ? 'w' : 'o');
      drawLine(canvas, 20, 5, 26, 8, pulse ? 'w' : 'o');
      drawLine(canvas, 2, 19, 8, 21, 's');
      drawLine(canvas, 20, 21, 26, 19, 's');
      break;
    case 'DBG':
      drawLine(canvas, 3, 23, 10, 23, pulse ? 'w' : 'o');
      drawLine(canvas, 4, 25, 8, 25, 'w');
      drawLine(canvas, 20, 4, 24, 8, 's');
      break;
    case 'SHIP':
      drawLine(canvas, 2, 21, 8, 19, 'w');
      drawLine(canvas, 26, 21, 20, 19, 'w');
      drawLine(canvas, 4, 24, 9, 22, pulse ? 'w' : 'o');
      drawLine(canvas, 24, 24, 19, 22, pulse ? 'w' : 'o');
      break;
    case 'CUR':
      drawRect(canvas, 5, 20, 9, 6, pulse ? 'w' : 'o');
      drawRect(canvas, 7, 22, 5, 2, 'h');
      drawLine(canvas, 21, 6, 25, 10, 's');
      break;
    case 'EXP':
      drawRect(canvas, 10, 21, 8, 5, pulse ? 'w' : 'o');
      drawLine(canvas, 11, 23, 17, 23, 'h');
      drawLine(canvas, 4, 20, 1, 17, 's');
      break;
  }
}

function drawLumaIdentityLayer(canvas: PixelCanvas, code: BuddyTypeCode, phase: PixelBuddyMotionPhase): void {
  const mark = LUMA_MARKS[code];
  const pulse = isPulsePhase(phase);
  const active: PixelToken = pulse ? 'w' : 'o';
  const quiet: PixelToken = phase === 0 ? 'h' : 'w';

  paint(canvas, mark.beacon.x, mark.beacon.y - 1, active);
  drawLine(canvas, mark.beacon.x - 1, mark.beacon.y, mark.beacon.x + 1, mark.beacon.y, quiet);
  paint(canvas, mark.beacon.x, mark.beacon.y + 1, 'e');

  paint(canvas, mark.core.x, mark.core.y - 1, active);
  drawLine(canvas, mark.core.x - 2, mark.core.y, mark.core.x + 2, mark.core.y, 'h');
  paint(canvas, mark.core.x, mark.core.y + 1, 's');
  if (isLiftPhase(phase) || pulse) {
    paint(canvas, mark.core.x - 3, mark.core.y, 'o');
    paint(canvas, mark.core.x + 3, mark.core.y, 'o');
  }
}

function drawRoleMotionAccent(canvas: PixelCanvas, code: BuddyTypeCode, phase: PixelBuddyMotionPhase, beat: number): void {
  if (phase === 0) return;
  const pulse = isPulsePhase(phase);
  const lift = isLiftPhase(phase);
  const accent: PixelToken = pulse ? 'w' : 'o';
  switch (code) {
    case 'ARC':
      paint(canvas, 10, 17, accent);
      paint(canvas, 14, 16, accent);
      paint(canvas, 18, 17, accent);
      drawLine(canvas, 10, 17, 14, 16, pulse ? 'w' : 'h');
      drawLine(canvas, 14, 16, 18, 17, pulse ? 'w' : 'h');
      paint(canvas, 8 + (beat % 3) * 3, 5 + (beat % 2), 'w');
      paint(canvas, 20 - (beat % 3) * 2, 6 + (beat % 2), pulse ? 'w' : 'o');
      if (lift) {
        drawLine(canvas, 6, 6, 3, 4, 's');
        drawLine(canvas, 22, 6, 25, 4, 's');
      }
      break;
    case 'VIB':
      drawLine(canvas, 3, lift ? 6 : 13, 9, lift ? 4 : 8, accent);
      drawLine(canvas, 25, lift ? 6 : 13, 19, lift ? 4 : 8, accent);
      paint(canvas, 4, pulse ? 18 : 20, 'w');
      paint(canvas, 24, pulse ? 18 : 20, 'w');
      paint(canvas, 5 + (beat % 4), 8 + (beat % 3), pulse ? 'w' : 'o');
      paint(canvas, 23 - (beat % 4), 8 + ((beat + 1) % 3), pulse ? 'w' : 'o');
      break;
    case 'DBG':
      drawLine(canvas, 7, 10, 21, 10, accent);
      paint(canvas, 8 + (beat % 5) * 3, 9, 'w');
      paint(canvas, 8 + (beat % 5) * 3, 11, 'w');
      paint(canvas, 6, 24, pulse ? 'w' : 'o');
      paint(canvas, 8, 24, pulse ? 'w' : 'o');
      paint(canvas, 10, 24, pulse ? 'w' : 'o');
      break;
    case 'SHIP':
      drawLine(canvas, 5, lift ? 20 : 21, pulse ? 1 : 3, 23, 'w');
      drawLine(canvas, 23, lift ? 20 : 21, pulse ? 27 : 25, 23, 'w');
      drawLine(canvas, 8, 20, pulse ? 2 : 4, 21, accent);
      drawLine(canvas, 20, 20, pulse ? 26 : 24, 21, accent);
      drawLine(canvas, 1, 7 + (beat % 3), 6, 7 + ((beat + 1) % 3), pulse ? 'w' : 'o');
      drawLine(canvas, 22, 7 + ((beat + 2) % 3), 27, 7 + (beat % 3), pulse ? 'w' : 'o');
      break;
    case 'CUR':
      drawLine(canvas, 8, 18, 14, 18, accent);
      drawLine(canvas, 8, 20, 14, 20, pulse ? 'w' : 'h');
      drawLine(canvas, 9, 16 + (beat % 2), 14, 16 + (beat % 2), pulse ? 'w' : 'o');
      paint(canvas, 22, 8, 'w');
      paint(canvas, 24, 10, pulse ? 'w' : 'o');
      paint(canvas, 20 + (beat % 4), 5 + (beat % 3), pulse ? 'w' : 'o');
      break;
    case 'EXP':
      drawLine(canvas, 4, 18, 8, 16, accent);
      paint(canvas, lift ? 2 : 3, 16, 'w');
      paint(canvas, lift ? 4 : 5, 17, pulse ? 'w' : 'o');
      drawLine(canvas, 11, 22, 17, 22, pulse ? 'w' : 'h');
      drawLine(canvas, 2 + (beat % 3), 18, 6 + (beat % 3), 18 + (beat % 2), pulse ? 'w' : 'o');
      break;
  }
}

function drawAnimalFinishingDetails(
  canvas: PixelCanvas,
  code: BuddyTypeCode,
  bob: number,
  pulse: boolean,
  phase: PixelBuddyMotionPhase,
  beat: number,
): void {
  const y = bob;
  const active: PixelToken = pulse ? 'w' : 'o';
  const lift = isLiftPhase(phase);
  switch (code) {
    case 'ARC':
      drawLine(canvas, 11, 4 + y, 13, 2 + y, 'h');
      drawLine(canvas, 17, 4 + y, 15, 2 + y, 'h');
      drawLine(canvas, 9, 13 + y, 11, 15 + y, 's');
      drawLine(canvas, 19, 13 + y, 17, 15 + y, 's');
      drawLine(canvas, 13, 9 + y, 15, 9 + y, 'w');
      paint(canvas, 14, 10 + y, 'o');
      paint(canvas, 12, 17 + y, 'h');
      paint(canvas, 16, 17 + y, 'h');
      paint(canvas, 13, 20 + y, 'o');
      paint(canvas, 15, 20 + y, 'o');
      drawLine(canvas, 11, 22 + y, 13, 22 + y, 'w');
      drawLine(canvas, 15, 22 + y, 17, 22 + y, 'w');
      break;
    case 'VIB':
      drawLine(canvas, 14, 6 + y, 14, 16 + y, 'e');
      paint(canvas, 14, 9 + y, 'w');
      paint(canvas, 14, 13 + y, 'w');
      drawLine(canvas, 4, 10 + y, 9, 13 + y, 'h');
      drawLine(canvas, 24, 10 + y, 19, 13 + y, 'h');
      drawLine(canvas, 5, 15 + y, 10, 17 + y, active);
      drawLine(canvas, 23, 15 + y, 18, 17 + y, active);
      paint(canvas, 14, 20 + y, lift ? 'w' : 'o');
      break;
    case 'DBG':
      drawLine(canvas, 9, 4 + y, 11, 2 + y, 'w');
      drawLine(canvas, 19, 4 + y, 17, 2 + y, 'w');
      drawLine(canvas, 9, 13 + y, 12, 15 + y, 'h');
      drawLine(canvas, 19, 13 + y, 16, 15 + y, 'h');
      paint(canvas, 14, 10 + y, 'e');
      drawLine(canvas, 10, 11 + y, 5, 10 + y, 'h');
      drawLine(canvas, 10, 12 + y, 5, 13 + y, 's');
      drawLine(canvas, 18, 11 + y, 23, 10 + y, 'h');
      drawLine(canvas, 18, 12 + y, 23, 13 + y, 's');
      drawLine(canvas, 20, 17 + y, 24 + (beat % 2), 16 + y, active);
      drawLine(canvas, 20, 19 + y, 25, 19 + y + (beat % 2), 'h');
      paint(canvas, 14, 16 + y, 'w');
      break;
    case 'SHIP':
      drawLine(canvas, 14, 5 + y, 17, 6 + y, 'w');
      paint(canvas, 18, 6 + y, 'o');
      drawLine(canvas, 5, 11 + y, 11, 14 + y, 'h');
      drawLine(canvas, 23, 11 + y, 17, 14 + y, 'h');
      drawLine(canvas, 9, 20 + y, 5, 21 + y, active);
      drawLine(canvas, 19, 20 + y, 23, 21 + y, active);
      drawLine(canvas, 12, 18 + y, 9, 23 + y, 'w');
      drawLine(canvas, 16, 18 + y, 19, 23 + y, 'w');
      drawLine(canvas, 12, 23 + y, 10, 25 + y, 's');
      drawLine(canvas, 16, 23 + y, 18, 25 + y, 's');
      paint(canvas, 14, 10 + y, 'w');
      break;
    case 'CUR':
      drawLine(canvas, 20, 7 + y, 25, 9 + y, active);
      drawLine(canvas, 20, 13 + y, 25, 12 + y, 'h');
      drawLine(canvas, 8, 7 + y, 6, 5 + y, 'h');
      drawLine(canvas, 14, 7 + y, 16, 5 + y, 'h');
      paint(canvas, 5, 12 + y, 'e');
      drawLine(canvas, 7, 13 + y, 4, 13 + y, 's');
      drawLine(canvas, 13, 13 + y, 16, 13 + y, 's');
      paint(canvas, 8, 14 + y, 'h');
      paint(canvas, 14, 14 + y, 'h');
      drawLine(canvas, 10, 20 + y, 14, 20 + y, pulse || beat % 4 === 2 ? 'w' : 's');
      break;
    case 'EXP':
      drawLine(canvas, 6, 5 + y, 3, 11 + y, 'a');
      drawLine(canvas, 22, 5 + y, 25, 11 + y, 'a');
      drawLine(canvas, 8, 9 + y, 5, 15 + y, 'h');
      drawLine(canvas, 20, 9 + y, 23, 15 + y, 'h');
      drawLine(canvas, 7, 13 + y, 7, 20 + y, 'h');
      drawLine(canvas, 21, 13 + y, 21, 20 + y, 'h');
      paint(canvas, 13, 18 + y, 'e');
      paint(canvas, 15, 18 + y, 'e');
      drawLine(canvas, 12, 10 + y, 16, 10 + y, 'h');
      paint(canvas, 14, 11 + y, 'e');
      drawLine(canvas, 10, 14 + y, 18, 14 + y, 'a');
      drawLine(canvas, 10, 21 + y, 18, 21 + y, active);
      paint(canvas, lift ? 5 : 4, 15 + y + (beat % 2), 'w');
      break;
  }
}

function drawAnimalAccessoryLayer(
  canvas: PixelCanvas,
  code: BuddyTypeCode,
  bob: number,
  pulse: boolean,
  phase: PixelBuddyMotionPhase,
  beat: number,
): void {
  const y = bob;
  const accent: PixelToken = pulse ? 'w' : 'o';
  const motionBeat = phase === 0 ? 0 : beat;
  switch (code) {
    case 'ARC':
      drawLine(canvas, 10, 16 + y, 18, 16 + y, pulse ? 'w' : 'h');
      drawLine(canvas, 11, 18 + y, 17, 18 + y, 'a');
      drawLine(canvas, 12, 15 + y, 12, 19 + y, 's');
      drawLine(canvas, 16, 15 + y, 16, 19 + y, 's');
      paint(canvas, 14, 17 + y, motionBeat % 4 === 3 ? 'w' : 'o');
      paint(canvas, 7, 6 + (motionBeat % 2), accent);
      paint(canvas, 21, 6 + ((motionBeat + 1) % 2), accent);
      break;
    case 'VIB':
      drawLine(canvas, 13, 3 + y, 11, 1 + y, 'h');
      drawLine(canvas, 15, 3 + y, 17, 1 + y, 'h');
      paint(canvas, 10, 1 + y, pulse ? 'w' : 'o');
      paint(canvas, 18, 1 + y, pulse ? 'w' : 'o');
      drawWingEye(canvas, 6, 8 + y, pulse);
      drawWingEye(canvas, 22, 8 + y, pulse);
      paint(canvas, 6 + (motionBeat % 3), 15 + y, 'w');
      paint(canvas, 22 - (motionBeat % 3), 15 + y, 'w');
      break;
    case 'DBG':
      drawLine(canvas, 8, 7 + y, 20, 7 + y, 'e');
      drawLine(canvas, 13, 7 + y, 15, 7 + y, pulse ? 'w' : 'h');
      paint(canvas, 9 + (motionBeat % 4), 6 + y, pulse ? 'w' : 'o');
      paint(canvas, 19 - (motionBeat % 4), 6 + y, pulse ? 'w' : 'o');
      drawLine(canvas, 23, 17 + y, 26, 16 + y, 'w');
      drawLine(canvas, 22, 20 + y, 25, 20 + y, 'a');
      break;
    case 'SHIP':
      drawLine(canvas, 6, 9 + y, 12, 12 + y, pulse ? 'w' : 'h');
      drawLine(canvas, 22, 9 + y, 16, 12 + y, pulse ? 'w' : 'h');
      drawLine(canvas, 5, 12 + y, 11, 15 + y, 'a');
      drawLine(canvas, 23, 12 + y, 17, 15 + y, 'a');
      paint(canvas, 14, 6 + y, 'w');
      paint(canvas, 14, 8 + y, motionBeat % 4 === 2 ? 'w' : 'o');
      break;
    case 'CUR':
      drawLine(canvas, 8, 15 + y, 15, 15 + y, 's');
      drawLine(canvas, 8, 18 + y, 15, 18 + y, 's');
      drawLine(canvas, 11, 15 + y, 11, 18 + y, pulse ? 'w' : 'h');
      drawLine(canvas, 20, 6 + y, 24, 7 + y, pulse ? 'w' : 'h');
      drawLine(canvas, 20, 11 + y, 24, 10 + y, 'o');
      paint(canvas, 18, 8 + y, motionBeat % 4 === 3 ? 'w' : 'a');
      paint(canvas, 6, 19 + y, 'w');
      break;
    case 'EXP':
      drawLine(canvas, 10, 13 + y, 18, 13 + y, pulse ? 'w' : 'a');
      paint(canvas, 14, 14 + y, 'w');
      drawLine(canvas, 3, 16 + y, 1, 14 + y, pulse ? 'w' : 'o');
      drawLine(canvas, 1, 14 + y, 3, 12 + y, 'h');
      drawLine(canvas, 11, 22 + y, 17, 22 + y, 's');
      paint(canvas, 6 + (motionBeat % 2), 10 + y, pulse ? 'w' : 'o');
      break;
  }
}

function drawBuddyHabitat(canvas: PixelCanvas, code: BuddyTypeCode, pulse: boolean, beat: number): void {
  const active: PixelToken = pulse ? 'w' : 'o';
  switch (code) {
    case 'ARC':
      drawLine(canvas, 4, 23, 24, 23, 's');
      drawLine(canvas, 8, 25, 20, 25, 'g');
      drawConstellation(canvas, 5, 5, beat, active);
      drawConstellation(canvas, 21, 4, beat + 2, pulse ? 'w' : 's');
      break;
    case 'VIB':
      drawFlower(canvas, 4, 23, pulse);
      drawFlower(canvas, 24, 22, !pulse);
      drawLine(canvas, 6, 22, 11, 21, 's');
      drawLine(canvas, 22, 21, 17, 22, 's');
      paint(canvas, 8 + (beat % 3), 4, active);
      paint(canvas, 20 - (beat % 3), 5, active);
      break;
    case 'DBG':
      drawLine(canvas, 2, 5, 6, 5, 's');
      drawLine(canvas, 2, 5, 2, 9, 's');
      drawLine(canvas, 26, 5, 22, 5, 's');
      drawLine(canvas, 26, 5, 26, 9, 's');
      drawLine(canvas, 3, 24, 11, 24, pulse ? 'w' : 'o');
      paint(canvas, 5 + (beat % 4) * 2, 22, active);
      break;
    case 'SHIP':
      drawLine(canvas, 1, 24, 8, 22, 's');
      drawLine(canvas, 20, 22, 27, 24, 's');
      drawLine(canvas, 3, 7 + (beat % 2), 8, 6, active);
      drawLine(canvas, 20, 6, 25, 7 + ((beat + 1) % 2), active);
      drawLine(canvas, 4, 25, 10, 25, pulse ? 'w' : 'g');
      drawLine(canvas, 18, 25, 24, 25, pulse ? 'w' : 'g');
      break;
    case 'CUR':
      drawLine(canvas, 3, 24, 15, 22, 's');
      drawLine(canvas, 4, 22, 6, 20, 'o');
      drawLine(canvas, 12, 23, 14, 21, pulse ? 'w' : 'a');
      drawAcorn(canvas, 5, 20, pulse);
      drawLine(canvas, 18, 5, 24, 4, 's');
      drawLine(canvas, 23, 4, 25, 6, active);
      break;
    case 'EXP':
      drawLine(canvas, 2, 23, 7, 20, 's');
      drawLine(canvas, 7, 20, 13, 23, 's');
      drawLine(canvas, 13, 23, 21, 20, pulse ? 'w' : 'o');
      drawPawPrint(canvas, 4 + (beat % 2), 18, pulse);
      drawPawPrint(canvas, 22 - (beat % 2), 19, false);
      drawLine(canvas, 24, 15, 24, 22, 's');
      drawLine(canvas, 22, 15, 26, 15, active);
      break;
  }
}

function drawConstellation(canvas: PixelCanvas, cx: number, cy: number, beat: number, token: PixelToken): void {
  paint(canvas, cx, cy, token);
  paint(canvas, cx + 3, cy + 1, 'h');
  paint(canvas, cx + 5, cy - 1 + (beat % 2), token);
  drawLine(canvas, cx, cy, cx + 3, cy + 1, 's');
  drawLine(canvas, cx + 3, cy + 1, cx + 5, cy - 1 + (beat % 2), 's');
}

function drawFlower(canvas: PixelCanvas, cx: number, groundY: number, pulse: boolean): void {
  drawLine(canvas, cx, groundY, cx, groundY - 3, 's');
  paint(canvas, cx, groundY - 4, pulse ? 'w' : 'o');
  paint(canvas, cx - 1, groundY - 3, 'a');
  paint(canvas, cx + 1, groundY - 3, 'a');
  paint(canvas, cx, groundY - 2, 'h');
}

function drawAcorn(canvas: PixelCanvas, cx: number, cy: number, pulse: boolean): void {
  drawLine(canvas, cx - 1, cy, cx + 1, cy, pulse ? 'w' : 'o');
  drawLine(canvas, cx - 1, cy + 1, cx + 1, cy + 1, 'm');
  paint(canvas, cx, cy + 2, 'h');
}

function drawPawPrint(canvas: PixelCanvas, cx: number, cy: number, pulse: boolean): void {
  const toe: PixelToken = pulse ? 'w' : 'o';
  paint(canvas, cx, cy, 'h');
  paint(canvas, cx - 1, cy - 1, toe);
  paint(canvas, cx, cy - 2, toe);
  paint(canvas, cx + 1, cy - 1, toe);
}

function decorateHeroDisplayFrame(
  code: BuddyTypeCode,
  motionFrame: number,
  frame: LogicalSprite,
): LogicalSprite {
  void frame;
  const canvas = createDisplayCanvas(HERO_DIMENSIONS.width, HERO_DIMENSIONS.height * 2);
  const beat = resolvePixelBuddyMotionStep(motionFrame);
  const phase = resolvePixelBuddyMotionPhase(motionFrame);
  const pulse = isPulsePhase(phase);
  const lift = isLiftPhase(phase);

  drawHeroAura(canvas, code, beat, pulse);
  drawHeroStage(canvas, code, beat, pulse, lift);
  drawHeroAnimalPortrait(canvas, code, beat, phase);
  switch (code) {
    case 'ARC':
      decorateHeroOwl(canvas, beat, pulse);
      break;
    case 'VIB':
      decorateHeroButterfly(canvas, beat, pulse, lift);
      break;
    case 'DBG':
      decorateHeroFox(canvas, beat, pulse);
      break;
    case 'SHIP':
      decorateHeroSeaSwallow(canvas, beat, pulse, lift);
      break;
    case 'CUR':
      decorateHeroSquirrel(canvas, beat, pulse);
      break;
    case 'EXP':
      decorateHeroTrailDog(canvas, beat, pulse, lift);
      break;
  }
  drawHeroExpressionPolish(canvas, code, beat, pulse, lift);
  return canvas.map((row) => row.join(''));
}

function decorateCompactDisplayFrame(
  code: BuddyTypeCode,
  motionFrame: number,
  frame: LogicalSprite,
): LogicalSprite {
  void frame;
  const canvas = createDisplayCanvas(COMPACT_DIMENSIONS.width, COMPACT_DIMENSIONS.height * 2);
  const beat = resolvePixelBuddyMotionStep(motionFrame);
  const phase = resolvePixelBuddyMotionPhase(motionFrame);
  const pulse = isPulsePhase(phase);
  const lift = isLiftPhase(phase);
  drawCompactAnimalIcon(canvas, code, beat, pulse, lift);
  drawCompactMotionSpark(canvas, code, beat, pulse);
  return canvas.map((row) => row.join(''));
}

function drawCompactAnimalIcon(
  canvas: PixelCanvas,
  code: BuddyTypeCode,
  beat: number,
  pulse: boolean,
  lift: boolean,
): void {
  switch (code) {
    case 'VIB':
      drawCompactButterfly(canvas, beat, pulse, lift);
      break;
    case 'DBG':
      drawCompactFox(canvas, beat, pulse, lift);
      break;
    case 'SHIP':
      drawCompactSeaSwallow(canvas, beat, pulse, lift);
      break;
    case 'CUR':
      drawCompactSquirrel(canvas, beat, pulse, lift);
      break;
    case 'EXP':
      drawCompactDog(canvas, beat, pulse, lift);
      break;
    case 'ARC':
    default:
      drawCompactOwl(canvas, beat, pulse, lift);
      break;
  }
}

function drawCompactOwl(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse ? 'w' : 'o';
  displayFillEllipse(canvas, 10, 10 + y, 7, 8, 's');
  displayFillEllipse(canvas, 10, 9 + y, 6, 7, 'm');
  displayFillEllipse(canvas, 7, 8 + y, 3, 3, 'h');
  displayFillEllipse(canvas, 13, 8 + y, 3, 3, 'h');
  displayLine(canvas, 5, 5 + y, 8, 1 + y, 'h');
  displayLine(canvas, 15, 5 + y, 12, 1 + y, 'h');
  drawHeroEyePair(canvas, 7, 8 + y, 13, 8 + y, pulse, 'w');
  displayPaint(canvas, 10, 11 + y, active);
  displayLine(canvas, 7, 16 + y, 9, 18 + y, 'w');
  displayLine(canvas, 13, 16 + y, 11, 18 + y, 'w');
  displayPaint(canvas, 10, 2 + (lift ? 0 : beat % 2), active);
}

function drawCompactButterfly(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const rise = 0;
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayFillEllipse(canvas, 5, 8 + rise, 4, 6, 'a');
  displayFillEllipse(canvas, 15, 8 + rise, 4, 6, 'a');
  displayFillEllipse(canvas, 6, 14 - rise, 4, 4, 'm');
  displayFillEllipse(canvas, 14, 14 - rise, 4, 4, 'm');
  displayLine(canvas, 10, 5, 10, 17, 'e');
  displayLine(canvas, 9, 5, 7, 1, 'h');
  displayLine(canvas, 11, 5, 13, 1, 'h');
  displayPaint(canvas, 6, 7 + rise, active);
  displayPaint(canvas, 14, 7 + rise, active);
  displayPaint(canvas, 10, 10 + (beat % 3), 'w');
}

function drawCompactFox(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse ? 'w' : 'o';
  displayFillEllipse(canvas, 10, 9 + y, 6, 6, 'm');
  displayLine(canvas, 5, 5 + y, 7, 1 + y, 'm');
  displayLine(canvas, 15, 5 + y, 13, 1 + y, 'm');
  displayFillEllipse(canvas, 10, 12 + y, 4, 3, 'h');
  drawHeroEyePair(canvas, 8, 8 + y, 12, 8 + y, pulse, active);
  displayPaint(canvas, 10, 11 + y, 'e');
  displayFillEllipse(canvas, 16, 14 + y + (lift ? 1 : beat % 2), 4, 3, 'a');
  displayPaint(canvas, 18, 13 + y, 'w');
  displayLine(canvas, 5, 15 + y, 2, 14 + y, 'h');
}

function drawCompactSeaSwallow(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayFillEllipse(canvas, 10, 9 + y, 3, 6, 'm');
  displayFillEllipse(canvas, 11, 5 + y, 3, 3, 'h');
  displayLine(canvas, 13, 5 + y, 18, 7 + y, active);
  displayLine(canvas, 9, 10 + y, 1, 7 + y - (lift ? 1 : 0), 'm');
  displayLine(canvas, 11, 10 + y, 19, 7 + y - (lift ? 1 : 0), 'm');
  displayLine(canvas, 4, 11 + y, 9, 14 + y, 'a');
  displayLine(canvas, 16, 11 + y, 11, 14 + y, 'a');
  displayLine(canvas, 9, 15 + y, 6, 19, pulse ? 'w' : 'h');
  displayLine(canvas, 11, 15 + y, 14, 19, pulse ? 'w' : 'h');
  displayPaint(canvas, 12, 5 + y, 'e');
  displayPaint(canvas, 2 + (beat % 3), 4, active);
}

function drawCompactSquirrel(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse ? 'w' : 'o';
  displayFillEllipse(canvas, 15, 8 + y, 4, 6, 'm');
  displayLine(canvas, 16, 2 + y, 19, 5 + y, 'm');
  displayLine(canvas, 19, 5 + y, 19, 12 + y, 'm');
  displayLine(canvas, 19, 12 + y, 15, 16 + y, 'h');
  displayFillEllipse(canvas, 8, 10 + y, 5, 7, 'm');
  displayFillEllipse(canvas, 8, 13 + y, 3, 3, 'h');
  displayLine(canvas, 6, 6 + y, 4, 3 + y, 'h');
  displayLine(canvas, 10, 6 + y, 12, 3 + y, 'h');
  drawHeroEyePair(canvas, 6, 9 + y, 10, 9 + y, pulse, 'w');
  displayRect(canvas, 6, 15 + y, 5, 3, 'a');
  displayLine(canvas, 6, 16 + y, 11, 16 + y, active);
  displayPaint(canvas, 4 + (beat % 2), 17 + y, 'w');
}

function drawCompactDog(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayFillEllipse(canvas, 10, 9 + y, 6, 7, 'm');
  displayFillEllipse(canvas, 4, 9 + y, 3, 5, 'a');
  displayFillEllipse(canvas, 16, 9 + y, 3, 5, 'a');
  displayFillEllipse(canvas, 10, 12 + y, 4, 3, 'h');
  drawHeroEyePair(canvas, 8, 8 + y, 12, 8 + y, pulse, 'w');
  displayPaint(canvas, 10, 11 + y, 'e');
  displayLine(canvas, 8, 13 + y, 12, 13 + y, 'e');
  displayLine(canvas, 7, 16 + y, 13, 16 + y, active);
  displayPaint(canvas, 10, 17 + y, 'w');
  displayLine(canvas, 16, 15 + y, 19, 13 + y + (beat % 2), active);
}

function drawCompactMotionSpark(canvas: PixelCanvas, code: BuddyTypeCode, beat: number, pulse: boolean): void {
  const offset = PIXEL_BUDDY_CODES.indexOf(code);
  const active: PixelToken = pulse ? 'w' : 'o';
  displayPaint(canvas, 1 + ((beat + offset) % 5), 2, active);
  displayPaint(canvas, 18 - ((beat + offset) % 4), 18, pulse ? 'w' : 'g');
}

function drawHeroAnimalPortrait(
  canvas: PixelCanvas,
  code: BuddyTypeCode,
  beat: number,
  phase: PixelBuddyMotionPhase,
): void {
  const pulse = isPulsePhase(phase);
  const lift = isLiftPhase(phase);
  switch (code) {
    case 'VIB':
      drawHeroButterflyPortrait(canvas, beat, pulse, lift);
      break;
    case 'DBG':
      drawHeroFoxPortrait(canvas, beat, pulse, lift);
      break;
    case 'SHIP':
      drawHeroSeaSwallowPortrait(canvas, beat, pulse, lift);
      break;
    case 'CUR':
      drawHeroSquirrelPortrait(canvas, beat, pulse, lift);
      break;
    case 'EXP':
      drawHeroDogPortrait(canvas, beat, pulse, lift);
      break;
    case 'ARC':
    default:
      drawHeroOwlPortrait(canvas, beat, pulse, lift);
      break;
  }
}

function drawHeroOwlPortrait(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse ? 'w' : 'o';
  displayFillEllipse(canvas, 18, 18 + y, 12, 13, 's');
  displayFillEllipse(canvas, 18, 17 + y, 11, 12, 'm');
  displayFillEllipse(canvas, 13, 14 + y, 5, 6, 'h');
  displayFillEllipse(canvas, 23, 14 + y, 5, 6, 'h');
  displayFillEllipse(canvas, 18, 22 + y, 6, 5, 'a');
  displayLine(canvas, 10, 8 + y, 14, 2 + y, 'm');
  displayLine(canvas, 26, 8 + y, 22, 2 + y, 'm');
  displayLine(canvas, 12, 8 + y, 14, 3 + y, 'h');
  displayLine(canvas, 24, 8 + y, 22, 3 + y, 'h');
  drawHeroEyePair(canvas, 13, 14 + y, 23, 14 + y, pulse, 'w');
  displayLine(canvas, 16, 17 + y, 20, 17 + y, active);
  displayPaint(canvas, 18, 18 + y, 'w');
  displayLine(canvas, 9, 20 + y, 13, 24 + y, 'a');
  displayLine(canvas, 27, 20 + y, 23, 24 + y, 'a');
  displayLine(canvas, 14, 28 + y, 16, 30 + y, 'w');
  displayLine(canvas, 20, 30 + y, 22, 28 + y, 'w');
  displayPaint(canvas, 18, 7 + (lift ? 0 : beat % 2), active);
}

function drawHeroButterflyPortrait(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const wingRise = 0;
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayFillEllipse(canvas, 10, 14 + wingRise, 8, 10, 's');
  displayFillEllipse(canvas, 26, 14 + wingRise, 8, 10, 's');
  displayFillEllipse(canvas, 10, 13 + wingRise, 7, 9, 'a');
  displayFillEllipse(canvas, 26, 13 + wingRise, 7, 9, 'a');
  displayFillEllipse(canvas, 11, 23 - wingRise, 6, 7, 'm');
  displayFillEllipse(canvas, 25, 23 - wingRise, 6, 7, 'm');
  displayFillEllipse(canvas, 18, 18, 3, 12, 'e');
  displayLine(canvas, 16, 8, 13, 3, 'h');
  displayLine(canvas, 20, 8, 23, 3, 'h');
  displayPaint(canvas, 12, 2, active);
  displayPaint(canvas, 24, 2, active);
  drawHeroWingSpot(canvas, 9, 12 + wingRise, pulse);
  drawHeroWingSpot(canvas, 27, 12 + wingRise, pulse);
  drawHeroWingSpot(canvas, 10, 23 - wingRise, !pulse);
  drawHeroWingSpot(canvas, 26, 23 - wingRise, !pulse);
  displayLine(canvas, 18, 11, 8, 9 + wingRise, active);
  displayLine(canvas, 18, 11, 28, 9 + wingRise, active);
  displayLine(canvas, 18, 20, 8, 27 - wingRise, pulse ? 'w' : 'h');
  displayLine(canvas, 18, 20, 28, 27 - wingRise, pulse ? 'w' : 'h');
  displayPaint(canvas, 18, 13 + (beat % 3), 'w');
  displayPaint(canvas, 18, 19 + ((beat + 1) % 3), 'h');
}

function drawHeroFoxPortrait(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse ? 'w' : 'o';
  displayFillEllipse(canvas, 18, 17 + y, 10, 10, 's');
  displayFillEllipse(canvas, 18, 16 + y, 9, 9, 'm');
  displayLine(canvas, 10, 10 + y, 13, 2 + y, 'm');
  displayLine(canvas, 26, 10 + y, 23, 2 + y, 'm');
  displayLine(canvas, 12, 9 + y, 14, 4 + y, 'h');
  displayLine(canvas, 24, 9 + y, 22, 4 + y, 'h');
  displayFillEllipse(canvas, 18, 20 + y, 6, 5, 'h');
  displayFillEllipse(canvas, 18, 22 + y, 3, 3, 'w');
  drawHeroEyePair(canvas, 14, 15 + y, 22, 15 + y, pulse, active);
  displayLine(canvas, 15, 18 + y, 21, 18 + y, 'e');
  displayPaint(canvas, 18, 19 + y, 'e');
  displayLine(canvas, 12, 21 + y, 6, 19 + y, 'h');
  displayLine(canvas, 12, 22 + y, 6, 23 + y, 's');
  displayLine(canvas, 24, 21 + y, 30, 19 + y, 'h');
  displayLine(canvas, 24, 22 + y, 30, 23 + y, 's');
  displayFillEllipse(canvas, 29, 24 + y + (lift ? 1 : beat % 2), 7, 4, 'a');
  displayFillEllipse(canvas, 31, 23 + y + (lift ? 1 : beat % 2), 4, 2, 'w');
  displayLine(canvas, 8, 29 + y, 14, 30 + y, active);
}

function drawHeroSeaSwallowPortrait(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayFillEllipse(canvas, 18, 16 + y, 5, 9, 's');
  displayFillEllipse(canvas, 18, 15 + y, 4, 8, 'm');
  displayFillEllipse(canvas, 19, 10 + y, 5, 4, 'h');
  displayLine(canvas, 22, 10 + y, 29, 12 + y, active);
  displayPaint(canvas, 30, 12 + y, 'w');
  displayLine(canvas, 17, 17 + y, 3, 11 + y - (lift ? 1 : 0), 'm');
  displayLine(canvas, 19, 17 + y, 33, 11 + y - (lift ? 1 : 0), 'm');
  displayLine(canvas, 8, 14 + y, 2, 17 + y, 'h');
  displayLine(canvas, 28, 14 + y, 34, 17 + y, 'h');
  displayLine(canvas, 8, 20 + y, 15, 24 + y, 'a');
  displayLine(canvas, 28, 20 + y, 21, 24 + y, 'a');
  displayLine(canvas, 16, 24 + y, 12, 33, pulse ? 'w' : 'h');
  displayLine(canvas, 20, 24 + y, 24, 33, pulse ? 'w' : 'h');
  displayLine(canvas, 12, 33 + y, 10, 35, 's');
  displayLine(canvas, 24, 33 + y, 26, 35, 's');
  displayPaint(canvas, 21, 9 + y, 'e');
  displayPaint(canvas, 22, 8 + y, 'w');
  displayLine(canvas, 2, 7 + (beat % 3), 9, 6, active);
  displayLine(canvas, 27, 6, 34, 7 + ((beat + 1) % 3), active);
}

function drawHeroSquirrelPortrait(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse ? 'w' : 'o';
  displayFillEllipse(canvas, 27, 13 + y, 7, 10, 's');
  displayFillEllipse(canvas, 29, 13 + y, 5, 8, 'm');
  displayFillEllipse(canvas, 28, 11 + y, 3, 5, 'h');
  displayLine(canvas, 29, 4 + y, 34, 8 + y, 'm');
  displayLine(canvas, 34, 8 + y, 34, 18 + y, 'm');
  displayLine(canvas, 34, 18 + y, 28, 24 + y, 'm');
  displayLine(canvas, 27, 24 + y, 24, 18 + y, 'h');
  displayFillEllipse(canvas, 13, 17 + y, 8, 10, 's');
  displayFillEllipse(canvas, 13, 16 + y, 7, 9, 'm');
  displayFillEllipse(canvas, 13, 20 + y, 5, 5, 'h');
  displayLine(canvas, 9, 10 + y, 6, 6 + y, 'h');
  displayLine(canvas, 16, 10 + y, 19, 6 + y, 'h');
  drawHeroEyePair(canvas, 10, 15 + y, 16, 15 + y, pulse, 'w');
  displayPaint(canvas, 8, 17 + y, 'e');
  displayLine(canvas, 10, 19 + y, 16, 19 + y, active);
  displayRect(canvas, 9, 24 + y, 9, 5, 'a');
  displayLine(canvas, 10, 25 + y, 17, 25 + y, 'h');
  displayLine(canvas, 10, 28 + y, 17, 28 + y, active);
  drawHeroAcorn(canvas, 6 + (beat % 2), 29 + y, pulse);
}

function drawHeroDogPortrait(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const y = 0;
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayFillEllipse(canvas, 18, 17 + y, 10, 11, 's');
  displayFillEllipse(canvas, 18, 16 + y, 9, 10, 'm');
  displayFillEllipse(canvas, 8, 16 + y, 4, 9, 'a');
  displayFillEllipse(canvas, 28, 16 + y, 4, 9, 'a');
  displayFillEllipse(canvas, 18, 20 + y, 6, 5, 'h');
  displayFillEllipse(canvas, 18, 22 + y, 3, 3, 'w');
  drawHeroEyePair(canvas, 14, 15 + y, 22, 15 + y, pulse, 'w');
  displayPaint(canvas, 18, 18 + y, 'e');
  displayLine(canvas, 15, 21 + y, 21, 21 + y, 'e');
  displayLine(canvas, 13, 25 + y, 23, 25 + y, active);
  displayPaint(canvas, 18, 26 + y, 'w');
  displayLine(canvas, 7, 25 + y, 3, 23 + y + (beat % 2), 'h');
  displayLine(canvas, 29, 25 + y, 33, 23 + y + ((beat + 1) % 2), 'h');
  drawHeroPaw(canvas, 9 + (beat % 2), 31 + y, pulse);
  drawHeroPaw(canvas, 27 - (beat % 2), 31 + y, false);
  displayLine(canvas, 29, 27 + y, 34, 23 + y, active);
}

function drawHeroAura(canvas: PixelCanvas, code: BuddyTypeCode, beat: number, pulse: boolean): void {
  const offset = PIXEL_BUDDY_CODES.indexOf(code);
  const active: PixelToken = pulse ? 'w' : 'o';
  displayPaint(canvas, 3 + ((beat + offset) % 5), 4, active);
  displayPaint(canvas, 32 - ((beat + offset) % 5), 5, pulse ? 'w' : 's');
  displayPaint(canvas, 5 + ((beat + offset) % 4), 31, 'g');
  displayPaint(canvas, 31 - ((beat + offset) % 4), 30, pulse ? 'w' : 'g');
}

function drawHeroStage(
  canvas: PixelCanvas,
  code: BuddyTypeCode,
  beat: number,
  pulse: boolean,
  lift: boolean,
): void {
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  const glow: PixelToken = pulse ? 'w' : 'h';
  displayLine(canvas, 7, 33, 29, 33, 's');
  displayLine(canvas, 10, 34, 26, 34, pulse ? 'o' : 'g');
  displayLine(canvas, 14, 35, 22, 35, 'g');
  displayPaint(canvas, 18, 32, active);
  displayPaint(canvas, 11 + (beat % 4) * 4, 34, glow);

  switch (code) {
    case 'ARC':
      displayLine(canvas, 9, 31, 13, 30, active);
      displayLine(canvas, 23, 30, 27, 31, active);
      displayLine(canvas, 11, 30, 18, 28, 's');
      displayLine(canvas, 18, 28, 25, 30, 's');
      displayPaint(canvas, 18, 27, pulse ? 'w' : 'o');
      displayPaint(canvas, 6 + (beat % 3), 29, 'h');
      displayPaint(canvas, 30 - (beat % 3), 29, 'h');
      break;
    case 'VIB':
      displayLine(canvas, 5, 31, 13, 29, 'a');
      displayLine(canvas, 31, 31, 23, 29, 'a');
      displayPaint(canvas, 8 + (beat % 4), 30, active);
      displayPaint(canvas, 28 - (beat % 4), 30, active);
      displayPaint(canvas, 11, 35, pulse ? 'w' : 'o');
      displayPaint(canvas, 25, 35, pulse ? 'w' : 'o');
      break;
    case 'DBG':
      displayLine(canvas, 6, 30, 30, 30, 's');
      displayLine(canvas, 6 + (beat % 5) * 5, 29, 6 + (beat % 5) * 5, 32, active);
      displayRect(canvas, 8, 32, 3, 2, pulse ? 'w' : 'o');
      displayRect(canvas, 25, 32, 3, 2, pulse ? 'w' : 'o');
      displayPaint(canvas, 18, 30, 'e');
      break;
    case 'SHIP':
      displayLine(canvas, 2, 31, 11, 29 + (beat % 2), active);
      displayLine(canvas, 34, 31, 25, 29 + ((beat + 1) % 2), active);
      displayLine(canvas, 4, 35, 14, 33, 'h');
      displayLine(canvas, 32, 35, 22, 33, 'h');
      displayPaint(canvas, 6 + (beat % 5), 32, pulse ? 'w' : 'o');
      displayPaint(canvas, 30 - (beat % 5), 32, pulse ? 'w' : 'o');
      break;
    case 'CUR':
      displayLine(canvas, 5, 32, 16, 30, 'm');
      displayLine(canvas, 20, 30, 31, 32, 'm');
      displayLine(canvas, 8, 31, 14, 29, pulse ? 'w' : 'o');
      drawHeroAcorn(canvas, 28 - (beat % 2), 30, pulse);
      displayRect(canvas, 13, 32, 10, 2, 'a');
      displayLine(canvas, 14, 33, 22, 33, glow);
      break;
    case 'EXP':
      displayLine(canvas, 4, 31, 11, 29, 's');
      displayLine(canvas, 11, 29, 18, 31, pulse ? 'w' : 'o');
      displayLine(canvas, 18, 31, 27, 29, 's');
      drawHeroPaw(canvas, 7 + (beat % 2), 32, pulse);
      drawHeroPaw(canvas, 28 - (beat % 2), 33, false);
      displayPaint(canvas, 18, 30, active);
      break;
  }
}

function drawHeroExpressionPolish(
  canvas: PixelCanvas,
  code: BuddyTypeCode,
  beat: number,
  pulse: boolean,
  lift: boolean,
): void {
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  const glint: PixelToken = pulse ? 'w' : 'h';

  switch (code) {
    case 'ARC':
      displayLine(canvas, 10, 9, 16, 8, 'h');
      displayLine(canvas, 20, 8, 26, 9, 'h');
      displayPaint(canvas, 13, 9, 'w');
      displayPaint(canvas, 23, 9, 'w');
      displayLine(canvas, 15, 13, 21, 13, active);
      displayPaint(canvas, 18, 14, 'w');
      displayLine(canvas, 13, 18, 17, 20, 'h');
      displayLine(canvas, 23, 18, 19, 20, 'h');
      displayPaint(canvas, 18, 22 + (beat % 2), glint);
      break;
    case 'VIB':
      displayPaint(canvas, 13, 1, glint);
      displayPaint(canvas, 23, 1, glint);
      displayLine(canvas, 18, 8, 18, 24, 'e');
      displayPaint(canvas, 17, 10, active);
      displayPaint(canvas, 19, 14, active);
      displayPaint(canvas, 17, 18, pulse ? 'w' : 'a');
      displayPaint(canvas, 9 + (beat % 2), 9, 'w');
      displayPaint(canvas, 27 - (beat % 2), 9, 'w');
      displayPaint(canvas, 11, 20, glint);
      displayPaint(canvas, 25, 20, glint);
      break;
    case 'DBG':
      displayLine(canvas, 11, 6, 14, 3, 'h');
      displayLine(canvas, 25, 6, 22, 3, 'h');
      displayLine(canvas, 12, 10, 24, 10, 'w');
      displayPaint(canvas, 14 + (beat % 2), 9, active);
      displayPaint(canvas, 22 - (beat % 2), 9, active);
      displayPaint(canvas, 18, 16, 'e');
      displayLine(canvas, 12, 18, 7, 17, 'h');
      displayLine(canvas, 24, 18, 29, 17, 'h');
      displayLine(canvas, 27, 25, 33, 24, pulse ? 'w' : 'o');
      displayLine(canvas, 27, 27, 34, 28, 'h');
      break;
    case 'SHIP':
      displayPaint(canvas, 20, 8, 'e');
      displayPaint(canvas, 21, 7, 'w');
      displayLine(canvas, 8, 15, 14, 18, glint);
      displayLine(canvas, 28, 15, 22, 18, glint);
      displayLine(canvas, 7, 19, 14, 23, 'a');
      displayLine(canvas, 29, 19, 22, 23, 'a');
      displayLine(canvas, 16, 27, 12, 34, pulse ? 'w' : 'h');
      displayLine(canvas, 20, 27, 24, 34, pulse ? 'w' : 'h');
      break;
    case 'CUR':
      displayLine(canvas, 27, 6, 32, 9, glint);
      displayLine(canvas, 32, 10, 31, 17, 'h');
      displayLine(canvas, 31, 17, 25, 20, active);
      displayPaint(canvas, 9, 11, 'e');
      displayPaint(canvas, 15, 11, 'e');
      displayPaint(canvas, 8, 10, 'w');
      displayPaint(canvas, 14, 10, 'w');
      displayLine(canvas, 7, 15, 4, 14, 'h');
      displayLine(canvas, 15, 15, 18, 14, 'h');
      displayLine(canvas, 10, 23, 17, 23, pulse ? 'w' : 'h');
      break;
    case 'EXP':
      displayLine(canvas, 8, 8, 5, 18, 'h');
      displayLine(canvas, 28, 8, 31, 18, 'h');
      displayPaint(canvas, 14, 13, 'e');
      displayPaint(canvas, 22, 13, 'e');
      displayPaint(canvas, 14, 12, 'w');
      displayPaint(canvas, 22, 12, 'w');
      displayLine(canvas, 15, 17, 21, 17, 'h');
      displayPaint(canvas, 18, 18, 'e');
      displayLine(canvas, 14, 22, 22, 22, active);
      displayPaint(canvas, 30 + (beat % 2), 25, pulse ? 'w' : 'a');
      break;
  }
}

function decorateHeroOwl(canvas: PixelCanvas, beat: number, pulse: boolean): void {
  const active: PixelToken = pulse ? 'w' : 'o';
  displayLine(canvas, 13, 6, 16, 2, 'h');
  displayLine(canvas, 23, 6, 20, 2, 'h');
  displayLine(canvas, 11, 10, 16, 9, 'w');
  displayLine(canvas, 20, 9, 25, 10, 'w');
  displayLine(canvas, 12, 15, 17, 17, 'a');
  displayLine(canvas, 24, 15, 19, 17, 'a');
  displayLine(canvas, 16, 21, 20, 21, active);
  displayLine(canvas, 14, 26, 17, 28, 'h');
  displayLine(canvas, 22, 26, 19, 28, 'h');
  drawHeroConstellation(canvas, 6, 7, beat, active);
  drawHeroConstellation(canvas, 27, 7, beat + 2, pulse ? 'w' : 's');
  displayLine(canvas, 14, 32, 17, 32, 'w');
  displayLine(canvas, 19, 32, 22, 32, 'w');
}

function decorateHeroButterfly(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayLine(canvas, 17, 6, 14, 2, 'h');
  displayLine(canvas, 19, 6, 22, 2, 'h');
  displayPaint(canvas, 13, 1, active);
  displayPaint(canvas, 23, 1, active);
  displayLine(canvas, 18, 8, 18, 24, 'e');
  displayLine(canvas, 18, 11, 7, lift ? 8 : 10, active);
  displayLine(canvas, 18, 11, 29, lift ? 8 : 10, active);
  displayLine(canvas, 18, 17, 7, 21, pulse ? 'w' : 'a');
  displayLine(canvas, 18, 17, 29, 21, pulse ? 'w' : 'a');
  drawHeroWingSpot(canvas, 8, 12, pulse);
  drawHeroWingSpot(canvas, 28, 12, pulse);
  drawHeroWingSpot(canvas, 10, 21, !pulse);
  drawHeroWingSpot(canvas, 26, 21, !pulse);
  displayPaint(canvas, 5 + (beat % 4), 27, active);
  displayPaint(canvas, 31 - (beat % 4), 26, active);
}

function decorateHeroFox(canvas: PixelCanvas, beat: number, pulse: boolean): void {
  const active: PixelToken = pulse ? 'w' : 'o';
  displayLine(canvas, 11, 7, 14, 2, 'w');
  displayLine(canvas, 25, 7, 22, 2, 'w');
  displayLine(canvas, 12, 11, 24, 11, 'e');
  displayLine(canvas, 13, 10, 17, 10, active);
  displayLine(canvas, 19, 10, 23, 10, active);
  displayLine(canvas, 15, 15, 21, 15, 'h');
  displayPaint(canvas, 18, 16, 'e');
  displayLine(canvas, 14, 17, 8, 16, 'h');
  displayLine(canvas, 14, 18, 8, 20, 's');
  displayLine(canvas, 22, 17, 28, 16, 'h');
  displayLine(canvas, 22, 18, 28, 20, 's');
  displayLine(canvas, 24, 24, 33, 23 + (beat % 2), active);
  displayLine(canvas, 25, 27, 34, 28, 'a');
  displayLine(canvas, 27, 25, 31, 25, 'w');
  displayLine(canvas, 5, 31, 13, 31, pulse ? 'w' : 'o');
}

function decorateHeroSeaSwallow(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayLine(canvas, 18, 7, 23, 9, 'w');
  displayPaint(canvas, 24, 9, active);
  displayLine(canvas, 8, 14, 2, lift ? 11 : 13, active);
  displayLine(canvas, 28, 14, 34, lift ? 11 : 13, active);
  displayLine(canvas, 7, 17, 14, 21, 'h');
  displayLine(canvas, 29, 17, 22, 21, 'h');
  displayLine(canvas, 9, 20, 15, 24, 'a');
  displayLine(canvas, 27, 20, 21, 24, 'a');
  displayLine(canvas, 15, 27, 11, 34, 'w');
  displayLine(canvas, 21, 27, 25, 34, 'w');
  displayLine(canvas, 15, 34, 13, 35, 's');
  displayLine(canvas, 21, 34, 23, 35, 's');
  displayLine(canvas, 1, 8 + (beat % 3), 8, 7, pulse ? 'w' : 'o');
  displayLine(canvas, 28, 7, 35, 8 + ((beat + 1) % 3), pulse ? 'w' : 'o');
}

function decorateHeroSquirrel(canvas: PixelCanvas, beat: number, pulse: boolean): void {
  const active: PixelToken = pulse ? 'w' : 'o';
  displayLine(canvas, 25, 5, 32, 8, 'h');
  displayLine(canvas, 32, 8, 32, 17, 'm');
  displayLine(canvas, 32, 17, 26, 22, 'h');
  displayLine(canvas, 26, 22, 23, 17, 'm');
  displayLine(canvas, 27, 8, 30, 11, active);
  displayLine(canvas, 30, 11, 29, 16, 'h');
  displayLine(canvas, 29, 16, 25, 18, active);
  displayLine(canvas, 9, 9, 6, 6, 'h');
  displayLine(canvas, 16, 9, 19, 6, 'h');
  displayLine(canvas, 8, 17, 16, 17, 'h');
  displayLine(canvas, 9, 19, 16, 19, pulse ? 'w' : 'o');
  displayRect(canvas, 9, 21, 9, 5, 'a');
  displayLine(canvas, 10, 22, 17, 22, 'h');
  displayLine(canvas, 10, 25, 17, 25, active);
  drawHeroAcorn(canvas, 6 + (beat % 2), 28, pulse);
}

function decorateHeroTrailDog(canvas: PixelCanvas, beat: number, pulse: boolean, lift: boolean): void {
  const active: PixelToken = pulse || lift ? 'w' : 'o';
  displayLine(canvas, 9, 7, 4, 16, 'a');
  displayLine(canvas, 27, 7, 32, 16, 'a');
  displayLine(canvas, 10, 11, 6, 20, 'h');
  displayLine(canvas, 26, 11, 30, 20, 'h');
  displayLine(canvas, 14, 15, 22, 15, 'h');
  displayPaint(canvas, 18, 17, 'e');
  displayLine(canvas, 14, 19, 22, 19, 'a');
  displayLine(canvas, 12, 24, 24, 24, active);
  displayPaint(canvas, 18, 25, 'w');
  drawHeroPaw(canvas, 5 + (beat % 2), 26, pulse);
  drawHeroPaw(canvas, 30 - (beat % 2), 28, false);
  displayLine(canvas, 30, 19, 30, 30, 's');
  displayLine(canvas, 27, 19, 33, 19, active);
  displayLine(canvas, 27, 31, 33, 31, pulse ? 'w' : 'g');
}

function drawHeroConstellation(canvas: PixelCanvas, cx: number, cy: number, beat: number, token: PixelToken): void {
  displayPaint(canvas, cx, cy, token);
  displayPaint(canvas, cx + 4, cy + 2, 'h');
  displayPaint(canvas, cx + 7, cy - 1 + (beat % 2), token);
  displayLine(canvas, cx, cy, cx + 4, cy + 2, 's');
  displayLine(canvas, cx + 4, cy + 2, cx + 7, cy - 1 + (beat % 2), 's');
}

function drawHeroWingSpot(canvas: PixelCanvas, cx: number, cy: number, pulse: boolean): void {
  displayPaint(canvas, cx, cy - 2, pulse ? 'w' : 'o');
  displayPaint(canvas, cx - 1, cy - 1, 'h');
  displayPaint(canvas, cx, cy - 1, 'e');
  displayPaint(canvas, cx + 1, cy - 1, 'h');
  displayLine(canvas, cx - 2, cy, cx + 2, cy, pulse ? 'w' : 'a');
}

function drawHeroAcorn(canvas: PixelCanvas, cx: number, cy: number, pulse: boolean): void {
  displayLine(canvas, cx - 2, cy, cx + 2, cy, pulse ? 'w' : 'o');
  displayLine(canvas, cx - 2, cy + 1, cx + 2, cy + 1, 'm');
  displayLine(canvas, cx - 1, cy + 2, cx + 1, cy + 2, 'h');
  displayPaint(canvas, cx, cy + 3, 's');
}

function drawHeroPaw(canvas: PixelCanvas, cx: number, cy: number, pulse: boolean): void {
  const toe: PixelToken = pulse ? 'w' : 'o';
  displayPaint(canvas, cx, cy, 'h');
  displayPaint(canvas, cx - 2, cy - 1, toe);
  displayPaint(canvas, cx, cy - 2, toe);
  displayPaint(canvas, cx + 2, cy - 1, toe);
}

function drawHeroEyePair(
  canvas: PixelCanvas,
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number,
  blink: boolean,
  glint: PixelToken,
): void {
  if (blink) {
    displayLine(canvas, leftX - 1, leftY, leftX + 1, leftY, 'e');
    displayLine(canvas, rightX - 1, rightY, rightX + 1, rightY, 'e');
    return;
  }
  displayPaint(canvas, leftX, leftY, 'e');
  displayPaint(canvas, rightX, rightY, 'e');
  displayPaint(canvas, leftX, leftY - 1, glint);
  displayPaint(canvas, rightX, rightY - 1, glint);
}

function createDisplayCanvas(width: number, height: number): PixelCanvas {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => PIXEL_EMPTY));
}

function displayFillEllipse(
  canvas: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  token: PixelToken,
): void {
  const minX = Math.floor(cx - rx);
  const maxX = Math.ceil(cx + rx);
  const minY = Math.floor(cy - ry);
  const maxY = Math.ceil(cy + ry);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        displayPaint(canvas, x, y, token);
      }
    }
  }
}

function displayPaint(canvas: PixelCanvas, x: number, y: number, token: PixelToken): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || py >= canvas.length || px >= (canvas[py]?.length ?? 0)) return;
  canvas[py][px] = token;
}

function displayLine(canvas: PixelCanvas, x1: number, y1: number, x2: number, y2: number, token: PixelToken): void {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  if (steps === 0) {
    displayPaint(canvas, x1, y1, token);
    return;
  }
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    displayPaint(canvas, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, token);
  }
}

function displayRect(canvas: PixelCanvas, x: number, y: number, width: number, height: number, token: PixelToken): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      displayPaint(canvas, px, py, token);
    }
  }
}

function drawWingEye(canvas: PixelCanvas, cx: number, cy: number, pulse: boolean): void {
  paint(canvas, cx, cy - 1, pulse ? 'w' : 'o');
  paint(canvas, cx - 1, cy, 'h');
  paint(canvas, cx, cy, 'e');
  paint(canvas, cx + 1, cy, 'h');
  paint(canvas, cx, cy + 1, pulse ? 'w' : 'a');
}

function isLiftPhase(phase: PixelBuddyMotionPhase): boolean {
  return phase === 2 || phase === 4;
}

function isPulsePhase(phase: PixelBuddyMotionPhase): boolean {
  return phase === 3 || phase === 5;
}

function applySpriteDepth(canvas: PixelCanvas): void {
  const source = canvas.map((row) => [...row]);
  for (let y = LOGICAL_HEIGHT - 2; y >= 0; y -= 1) {
    for (let x = LOGICAL_WIDTH - 2; x >= 0; x -= 1) {
      if (!isSolidSpriteToken(source[y][x])) continue;
      const shadowX = x + 1;
      const shadowY = y + 1;
      if (source[shadowY][shadowX] === PIXEL_EMPTY || source[shadowY][shadowX] === 'g') {
        canvas[shadowY][shadowX] = 's';
      }
    }
  }

  for (let y = 1; y < LOGICAL_HEIGHT; y += 1) {
    for (let x = 1; x < LOGICAL_WIDTH; x += 1) {
      const token = source[y][x];
      if (token !== 'm' && token !== 'a') continue;
      const touchesAir = isSpriteAir(source[y - 1][x]) || isSpriteAir(source[y][x - 1]);
      if (touchesAir && (x + y) % 3 !== 0) {
        canvas[y][x] = token === 'm' ? 'o' : 'h';
      }
    }
  }
}

function isSolidSpriteToken(token: PixelToken | undefined): boolean {
  return token === 'm' || token === 'o' || token === 'a' || token === 'h' || token === 'e' || token === 'w';
}

function isSpriteAir(token: PixelToken | undefined): boolean {
  return token === undefined || token === PIXEL_EMPTY || token === 'g' || token === 's';
}

function drawOwlArchitect(canvas: PixelCanvas, bob: number, blink: boolean, pulse: boolean): void {
  const y = bob;
  drawSpriteTemplate(canvas, BUDDY_BASE_SPRITES.ARC, y);
  drawEyes(canvas, 10, 7 + y, 18, 7 + y, blink);
  drawEyes(canvas, 9, 8 + y, 19, 8 + y, blink);
  drawLine(canvas, 9, 12 + y, 19, 12 + y, pulse ? 'w' : 'o');
  drawLine(canvas, 11, 15 + y, 17, 15 + y, pulse ? 'w' : 'h');
  paint(canvas, 14, 5 + y, pulse ? 'w' : 'o');
}

function drawButterflyDirector(canvas: PixelCanvas, bob: number, blink: boolean, pulse: boolean): void {
  const y = bob;
  drawSpriteTemplate(canvas, BUDDY_BASE_SPRITES.VIB, y);
  drawEyes(canvas, 13, 5 + y, 15, 5 + y, blink);
  drawLine(canvas, 3, pulse ? 8 + y : 10 + y, 10, 12 + y, pulse ? 'w' : 'h');
  drawLine(canvas, 25, pulse ? 8 + y : 10 + y, 18, 12 + y, pulse ? 'w' : 'h');
  drawLine(canvas, 5, 15 + y, 11, 17 + y, pulse ? 'w' : 'o');
  drawLine(canvas, 23, 15 + y, 17, 17 + y, pulse ? 'w' : 'o');
}

function drawBreakpointFox(canvas: PixelCanvas, bob: number, blink: boolean, pulse: boolean): void {
  const y = bob;
  drawSpriteTemplate(canvas, BUDDY_BASE_SPRITES.DBG, y);
  drawEyes(canvas, 10, 7 + y, 18, 7 + y, blink);
  drawLine(canvas, 8, 6 + y, 13, 6 + y, pulse ? 'w' : 'h');
  drawLine(canvas, 15, 6 + y, 20, 6 + y, pulse ? 'w' : 'h');
  drawLine(canvas, 21, 16 + y, 26, 17 + y, pulse ? 'w' : 'a');
  drawLine(canvas, 3, 16 + y, 9, 16 + y, pulse ? 'w' : 'o');
}

function drawSeaSwallowShipper(canvas: PixelCanvas, bob: number, blink: boolean, pulse: boolean): void {
  const y = bob;
  drawSpriteTemplate(canvas, BUDDY_BASE_SPRITES.SHIP, y);
  drawEyes(canvas, 12, 5 + y, 16, 5 + y, blink);
  drawLine(canvas, 13, 6 + y, 15, 8 + y, pulse ? 'w' : 'o');
  drawLine(canvas, 13, 8 + y, 15, 8 + y, 'e');
  drawLine(canvas, 3, pulse ? 7 + y : 8 + y, 12, 11 + y, pulse ? 'w' : 'h');
  drawLine(canvas, 25, pulse ? 7 + y : 8 + y, 16, 11 + y, pulse ? 'w' : 'h');
  drawLine(canvas, 5, 10 + y, 11, 13 + y, 'o');
  drawLine(canvas, 23, 10 + y, 17, 13 + y, 'o');
  drawLine(canvas, 7, 18 + y, 1, 20 + y, pulse ? 'w' : 'o');
  drawLine(canvas, 21, 18 + y, 27, 20 + y, pulse ? 'w' : 'o');
  drawLine(canvas, 12, 18 + y, 9, 23 + y, 'h');
  drawLine(canvas, 16, 18 + y, 19, 23 + y, 'h');
  paint(canvas, 14, 3 + y, pulse ? 'w' : 'o');
}

function drawSquirrelCurator(canvas: PixelCanvas, bob: number, blink: boolean, pulse: boolean): void {
  const y = bob;
  drawSpriteTemplate(canvas, BUDDY_BASE_SPRITES.CUR, y);
  drawSquirrelTail(canvas, y, pulse);
  drawLine(canvas, 6, 9 + y, 10, 7 + y, 'm');
  drawLine(canvas, 8, 6 + y, 10, 8 + y, pulse ? 'w' : 'o');
  drawEyes(canvas, 8, 11 + y, 14, 11 + y, blink);
  paint(canvas, 5, 12 + y, 'e');
  drawLine(canvas, 6, 14 + y, 13, 14 + y, 'h');
  drawRect(canvas, 8, 15 + y, 7, 3, pulse ? 'w' : 'a');
  drawLine(canvas, 9, 16 + y, 14, 16 + y, 'h');
  drawLine(canvas, 9, 18 + y, 14, 18 + y, pulse ? 'w' : 'o');
  paint(canvas, 15, 15 + y, 'w');
}

function drawSquirrelTail(canvas: PixelCanvas, offsetY: number, pulse: boolean): void {
  const accent: PixelToken = pulse ? 'w' : 'o';
  drawLine(canvas, 20, 3 + offsetY, 25, 5 + offsetY, 's');
  drawLine(canvas, 25, 5 + offsetY, 25, 11 + offsetY, 's');
  drawLine(canvas, 25, 11 + offsetY, 20, 14 + offsetY, 's');
  drawLine(canvas, 20, 14 + offsetY, 17, 11 + offsetY, 's');
  drawLine(canvas, 20, 5 + offsetY, 23, 7 + offsetY, 'm');
  drawLine(canvas, 23, 7 + offsetY, 23, 10 + offsetY, 'm');
  drawLine(canvas, 23, 10 + offsetY, 20, 12 + offsetY, 'm');
  drawLine(canvas, 20, 12 + offsetY, 18, 10 + offsetY, 'm');
  drawLine(canvas, 20, 7 + offsetY, 21, 10 + offsetY, 'h');
  drawLine(canvas, 21, 5 + offsetY, 24, 6 + offsetY, accent);
  drawLine(canvas, 21, 13 + offsetY, 24, 11 + offsetY, 'h');
}

function drawTrailDog(canvas: PixelCanvas, bob: number, blink: boolean, pulse: boolean): void {
  const y = bob;
  drawSpriteTemplate(canvas, BUDDY_BASE_SPRITES.EXP, y);
  drawEyes(canvas, 11, 7 + y, 17, 7 + y, blink);
  paint(canvas, 14, 11 + y, 'e');
  drawLine(canvas, 11, 13 + y, 17, 13 + y, pulse ? 'w' : 'h');
  drawRect(canvas, 10, 21 + y, 8, 2, pulse ? 'w' : 'o');
  drawLine(canvas, 11, 22 + y, 17, 22 + y, 'h');
  paint(canvas, pulse ? 5 : 4, 10 + y, 'w');
}

function drawAmbientSparkles(canvas: PixelCanvas, code: BuddyTypeCode, pulse: boolean): void {
  const offset = PIXEL_BUDDY_CODES.indexOf(code);
  const token: PixelToken = pulse ? 'w' : 'g';
  paint(canvas, 2 + (offset % 4), 3, token);
  paint(canvas, 25 - (offset % 5), 4, token);
  paint(canvas, 4 + (offset % 6), 24, token);
  if (pulse) {
    paint(canvas, 23, 24, 'w');
    paint(canvas, 24, 23, 'w');
  }
}

function drawEyes(canvas: PixelCanvas, leftX: number, leftY: number, rightX: number, rightY: number, blink: boolean): void {
  if (blink) {
    drawLine(canvas, leftX - 1, leftY, leftX + 1, leftY, 'e');
    drawLine(canvas, rightX - 1, rightY, rightX + 1, rightY, 'e');
    return;
  }
  paint(canvas, leftX, leftY, 'e');
  paint(canvas, rightX, rightY, 'e');
  paint(canvas, leftX, leftY - 1, 'h');
  paint(canvas, rightX, rightY - 1, 'h');
}

function drawSpriteTemplate(canvas: PixelCanvas, sprite: LogicalSprite, offsetY: number): void {
  for (let y = 0; y < sprite.length; y += 1) {
    const row = parsePixelRow(sprite[y], LOGICAL_WIDTH);
    for (let x = 0; x < row.length; x += 1) {
      const token = row[x] ?? PIXEL_EMPTY;
      if (token === PIXEL_EMPTY) continue;
      paint(canvas, x, y + offsetY, token);
    }
  }
}

function createCanvas(): PixelCanvas {
  return Array.from({ length: LOGICAL_HEIGHT }, () => Array.from({ length: LOGICAL_WIDTH }, () => PIXEL_EMPTY));
}

function paint(canvas: PixelCanvas, x: number, y: number, token: PixelToken): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || px >= LOGICAL_WIDTH || py < 0 || py >= LOGICAL_HEIGHT) return;
  canvas[py][px] = token;
}

function drawDitheredEllipseRing(
  canvas: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  offset: number,
  token: PixelToken,
): void {
  for (let index = 0; index < 18; index += 1) {
    const angle = ((index * 20 + offset * 7) / 180) * Math.PI;
    if ((index + offset) % 3 === 1) continue;
    paint(canvas, cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, token);
  }
}

function drawLine(canvas: PixelCanvas, x1: number, y1: number, x2: number, y2: number, token: PixelToken): void {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  if (steps === 0) {
    paint(canvas, x1, y1, token);
    return;
  }
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    paint(canvas, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, token);
  }
}

function drawRect(canvas: PixelCanvas, x: number, y: number, width: number, height: number, token: PixelToken): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      paint(canvas, px, py, token);
    }
  }
}

function sampleSprite(rows: LogicalSprite, targetWidth: number, targetHeight: number): LogicalSprite {
  if (targetWidth === LOGICAL_WIDTH && targetHeight === LOGICAL_HEIGHT) return rows;
  return Array.from({ length: targetHeight }, (_, y) => {
    const sourceY = Math.min(LOGICAL_HEIGHT - 1, Math.floor((y / targetHeight) * LOGICAL_HEIGHT));
    return Array.from({ length: targetWidth }, (_, x) => {
      const sourceX = Math.min(LOGICAL_WIDTH - 1, Math.floor((x / targetWidth) * LOGICAL_WIDTH));
      return rows[sourceY]?.[sourceX] ?? PIXEL_EMPTY;
    }).join('');
  });
}

function expandLogicalSprite(rows: LogicalSprite): PixelFrame {
  const output = Array.from({ length: SOURCE_HEIGHT }, () => Array.from({ length: SOURCE_WIDTH }, () => PIXEL_EMPTY));
  for (let pixelY = 0; pixelY < LOGICAL_HEIGHT; pixelY += 1) {
    const row = parsePixelRow(rows[pixelY], LOGICAL_WIDTH);
    for (let pixelX = 0; pixelX < LOGICAL_WIDTH; pixelX += 1) {
      const token = row[pixelX] ?? PIXEL_EMPTY;
      for (let y = 0; y < CELL_SOURCE_HEIGHT; y += 1) {
        for (let x = 0; x < CELL_SOURCE_WIDTH; x += 1) {
          output[pixelY * CELL_SOURCE_HEIGHT + y][pixelX * CELL_SOURCE_WIDTH + x] = token;
        }
      }
    }
  }
  return output.map((row) => row.join(''));
}

function resolveHalfBlockCell(
  top: PixelToken | undefined,
  bottom: PixelToken | undefined,
  palette: Record<PixelToken, RGBA>,
  background: RGBA,
): BuddyCell {
  const topToken = top ?? PIXEL_EMPTY;
  const bottomToken = bottom ?? PIXEL_EMPTY;
  const topColor = topToken === PIXEL_EMPTY ? background : palette[topToken];
  const bottomColor = bottomToken === PIXEL_EMPTY ? background : palette[bottomToken];

  if (topToken === PIXEL_EMPTY && bottomToken === PIXEL_EMPTY) {
    return { char: ' ', fg: background, bg: background };
  }
  if (topToken === bottomToken) {
    return { char: '█', fg: topColor, bg: background };
  }
  return { char: '▀', fg: topColor, bg: bottomColor };
}

function parsePixelRow(row: string | undefined, width: number): readonly PixelToken[] {
  const chars = Array.from(row ?? '');
  return Array.from({ length: width }, (_, index) => {
    const char = chars[index] ?? PIXEL_EMPTY;
    return isPixelToken(char) ? char : PIXEL_EMPTY;
  });
}

function isPixelToken(value: string): value is PixelToken {
  return value === '.'
    || value === 'g'
    || value === 's'
    || value === 'm'
    || value === 'o'
    || value === 'a'
    || value === 'h'
    || value === 'e'
    || value === 'w';
}

function parsePalette(palette: BuddyAvatarPalette): Record<PixelToken, RGBA> {
  return {
    '.': toRgba(palette['.']),
    g: toRgba(palette.g),
    s: toRgba(palette.s),
    m: toRgba(palette.m),
    o: toRgba(palette.o),
    a: toRgba(palette.a),
    h: toRgba(palette.h),
    e: toRgba(palette.e),
    w: toRgba(palette.w),
  };
}

function toRgba(color: string | undefined): RGBA {
  if (!color || color === 'transparent') return TRANSPARENT;
  try {
    return parseColor(color);
  } catch {
    return TRANSPARENT;
  }
}

function defaultBuddyPalette(): BuddyAvatarPalette {
  return {
    '.': 'transparent',
    g: '#1f2937',
    s: '#475569',
    m: '#60a5fa',
    o: '#7dd3fc',
    a: '#a78bfa',
    h: '#e5e7eb',
    e: '#0f172a',
    w: '#fbbf24',
  };
}

export function resolvePixelBuddyPalette(
  code: BuddyTypeCode,
  theme: ResolvedTuiTheme,
): BuddyAvatarPalette {
  const role = BUDDY_ROLE_PALETTES[code];
  return {
    '.': theme.semantic.fill.grouped,
    g: theme.semantic.separator,
    ...role,
  };
}
