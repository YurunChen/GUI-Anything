import { describe, expect, it } from 'bun:test';
import type { BuddyTypeCode } from '../../observer/view-model/buddy-profile';
import { buildResolvedTuiTheme } from '../themes/resolved-theme';
import {
  PIXEL_BUDDY_CODES,
  getPixelBuddySpriteDimensions,
  getPixelBuddyFrameCount,
  resolvePixelBuddyDisplayFrame,
  resolvePixelBuddyFrame,
  resolvePixelBuddyMotionPhase,
  resolvePixelBuddyPalette,
} from './PixelBuddySprite';

const BUDDY_CODES = ['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const satisfies readonly BuddyTypeCode[];

describe('resolvePixelBuddyFrame', () => {
  it('exposes exactly the six animal buddy identities', () => {
    expect(PIXEL_BUDDY_CODES).toEqual(BUDDY_CODES);
  });

  it('keeps every buddy sprite as a stable 56x56 pixel source matrix', () => {
    for (const code of BUDDY_CODES) {
      const frame = resolvePixelBuddyFrame(code, 0);

      expect(frame).toHaveLength(56);
      expect(frame.every((line) => line.length === 56)).toBe(true);
    }
  });

  it('uses a longer motion sequence than the raw variant count', () => {
    for (const code of BUDDY_CODES) {
      expect(getPixelBuddyFrameCount(code)).toBeGreaterThanOrEqual(16);
    }
  });

  it('keeps the shared motion clock aligned to stable, blink, lift, and pulse phases', () => {
    expect(resolvePixelBuddyMotionPhase(0)).toBe(0);
    expect(resolvePixelBuddyMotionPhase(1)).toBe(0);
    expect(resolvePixelBuddyMotionPhase(2)).toBe(1);
    expect(resolvePixelBuddyMotionPhase(4)).toBe(2);
    expect(resolvePixelBuddyMotionPhase(5)).toBe(4);
    expect(resolvePixelBuddyMotionPhase(8)).toBe(3);
    expect(resolvePixelBuddyMotionPhase(9)).toBe(5);
  });

  it('cycles animated frames with resting frames between motion beats', () => {
    expect(resolvePixelBuddyFrame('VIB', 0)).toEqual(resolvePixelBuddyFrame('VIB', 1));
    expect(resolvePixelBuddyFrame('VIB', 1)).not.toEqual(resolvePixelBuddyFrame('VIB', 2));
  });

  it('gives every buddy a real motion beat', () => {
    for (const code of BUDDY_CODES) {
      const restingFrame = resolvePixelBuddyFrame(code, 0);
      const motionFrames = [2, 4, 7].map((frame) => resolvePixelBuddyFrame(code, frame));

      expect(motionFrames.some((frame) => frame.join('\n') !== restingFrame.join('\n'))).toBe(true);
    }
  });

  it('keeps at least three distinct visual poses for each buddy', () => {
    for (const code of BUDDY_CODES) {
      const uniqueFrames = new Set(
        Array.from({ length: getPixelBuddyFrameCount(code) }, (_, index) => resolvePixelBuddyFrame(code, index).join('\n')),
      );

      expect(uniqueFrames.size).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps a rich role-specific animation loop in the displayed hero avatar', () => {
    for (const code of BUDDY_CODES) {
      const uniqueFrames = new Set(
        Array.from(
          { length: getPixelBuddyFrameCount(code) },
          (_, index) => resolvePixelBuddyDisplayFrame(code, index, 'hero').join('\n'),
        ),
      );

      expect(uniqueFrames.size).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps a visible continuous motion loop even in compact timeline avatars', () => {
    for (const code of BUDDY_CODES) {
      const uniqueFrames = new Set(
        Array.from(
          { length: getPixelBuddyFrameCount(code) },
          (_, index) => resolvePixelBuddyDisplayFrame(code, index, 'compact').join('\n'),
        ),
      );

      expect(uniqueFrames.size).toBeGreaterThanOrEqual(8);
    }
  });

  it('keeps adjacent animation frames smooth enough to read as idle motion instead of jumps', () => {
    for (const code of BUDDY_CODES) {
      const frameCount = getPixelBuddyFrameCount(code);
      const compactDiffs = Array.from({ length: frameCount }, (_, index) => frameDiff(
        resolvePixelBuddyDisplayFrame(code, index, 'compact'),
        resolvePixelBuddyDisplayFrame(code, (index + 1) % frameCount, 'compact'),
      ));
      const heroDiffs = Array.from({ length: frameCount }, (_, index) => frameDiff(
        resolvePixelBuddyDisplayFrame(code, index, 'hero'),
        resolvePixelBuddyDisplayFrame(code, (index + 1) % frameCount, 'hero'),
      ));

      expect(Math.max(...compactDiffs)).toBeLessThanOrEqual(32);
      expect(Math.max(...heroDiffs)).toBeLessThanOrEqual(160);
      expect(Math.max(...compactDiffs)).toBeGreaterThan(4);
      expect(Math.max(...heroDiffs)).toBeGreaterThan(16);
    }
  });

  it('keeps ambient background marks sparse so the Luma silhouette stays readable', () => {
    for (const code of BUDDY_CODES) {
      const frame = resolvePixelBuddyFrame(code, 0).join('');
      const ambientCells = Array.from(frame).filter((token) => token === 'g').length;

      expect(ambientCells).toBeLessThan(160);
    }
  });

  it('keeps enough displayed detail for each hero animal to read as crafted pixel art', () => {
    for (const code of BUDDY_CODES) {
      const frame = resolvePixelBuddyDisplayFrame(code, 0, 'hero').join('');
      const solidCells = Array.from(frame).filter((token) => !['.', 'g', 's'].includes(token)).length;
      const detailCells = Array.from(frame).filter((token) => ['w', 'h', 'a'].includes(token)).length;

      expect(solidCells).toBeGreaterThan(300);
      expect(detailCells).toBeGreaterThan(80);
    }
  });

  it('keeps the hero expression area polished with eyes, highlights, and face detail', () => {
    for (const code of BUDDY_CODES) {
      const faceBand = resolvePixelBuddyDisplayFrame(code, 8, 'hero').slice(4, 25).join('');
      const expressiveCells = Array.from(faceBand).filter((token) => ['w', 'h', 'e', 'o', 'a'].includes(token)).length;
      const eyeAndGlintCells = Array.from(faceBand).filter((token) => token === 'e' || token === 'w').length;

      expect(expressiveCells).toBeGreaterThan(160);
      expect(eyeAndGlintCells).toBeGreaterThan(35);
    }
  });

  it('draws recognizable animal portrait landmarks in the hero gallery sprites', () => {
    const owl = resolvePixelBuddyDisplayFrame('ARC', 0, 'hero');
    const butterfly = resolvePixelBuddyDisplayFrame('VIB', 0, 'hero');
    const fox = resolvePixelBuddyDisplayFrame('DBG', 0, 'hero');
    const swallow = resolvePixelBuddyDisplayFrame('SHIP', 0, 'hero');
    const squirrel = resolvePixelBuddyDisplayFrame('CUR', 0, 'hero');
    const dog = resolvePixelBuddyDisplayFrame('EXP', 0, 'hero');

    expect(regionTokenCount(owl, 8, 0, 28, 9, ['m', 'h', 'w'])).toBeGreaterThan(20);
    expect(regionTokenCount(owl, 8, 9, 28, 22, ['h', 'e', 'w'])).toBeGreaterThan(70);

    expect(regionTokenCount(butterfly, 2, 4, 15, 28, ['a', 'm', 'h', 'o', 'w'])).toBeGreaterThan(110);
    expect(regionTokenCount(butterfly, 21, 4, 34, 28, ['a', 'm', 'h', 'o', 'w'])).toBeGreaterThan(110);
    expect(regionTokenCount(butterfly, 16, 7, 20, 27, ['e', 'w', 'h'])).toBeGreaterThan(22);

    expect(regionTokenCount(fox, 9, 1, 27, 12, ['m', 'h', 'w'])).toBeGreaterThan(25);
    expect(regionTokenCount(fox, 25, 20, 35, 31, ['a', 'w', 'h'])).toBeGreaterThan(30);

    expect(regionTokenCount(swallow, 1, 10, 15, 24, ['m', 'h', 'a', 'o', 'w'])).toBeGreaterThan(45);
    expect(regionTokenCount(swallow, 21, 10, 35, 24, ['m', 'h', 'a', 'o', 'w'])).toBeGreaterThan(45);
    expect(regionTokenCount(swallow, 21, 8, 31, 14, ['o', 'w', 'h'])).toBeGreaterThan(5);

    expect(regionTokenCount(squirrel, 24, 4, 35, 25, ['m', 'h', 's', 'o', 'w'])).toBeGreaterThan(60);
    expect(regionTokenCount(squirrel, 6, 23, 19, 33, ['a', 'o', 'h', 'w'])).toBeGreaterThan(28);

    expect(regionTokenCount(dog, 4, 7, 12, 25, ['a', 'h'])).toBeGreaterThan(25);
    expect(regionTokenCount(dog, 24, 7, 32, 25, ['a', 'h'])).toBeGreaterThan(25);
    expect(regionTokenCount(dog, 14, 18, 23, 24, ['h', 'w', 'e'])).toBeGreaterThan(24);
  });

  it('keeps compact timeline avatars as recognizable animal icons', () => {
    const owl = resolvePixelBuddyDisplayFrame('ARC', 0, 'compact');
    const butterfly = resolvePixelBuddyDisplayFrame('VIB', 0, 'compact');
    const fox = resolvePixelBuddyDisplayFrame('DBG', 0, 'compact');
    const swallow = resolvePixelBuddyDisplayFrame('SHIP', 0, 'compact');
    const squirrel = resolvePixelBuddyDisplayFrame('CUR', 0, 'compact');
    const dog = resolvePixelBuddyDisplayFrame('EXP', 0, 'compact');

    expect(regionTokenCount(owl, 4, 0, 16, 9, ['m', 'h', 'w'])).toBeGreaterThan(18);
    expect(regionTokenCount(butterfly, 1, 4, 9, 18, ['a', 'm', 'o', 'w'])).toBeGreaterThan(35);
    expect(regionTokenCount(butterfly, 11, 4, 19, 18, ['a', 'm', 'o', 'w'])).toBeGreaterThan(35);
    expect(regionTokenCount(fox, 14, 11, 20, 18, ['a', 'w'])).toBeGreaterThan(10);
    expect(regionTokenCount(swallow, 1, 7, 19, 15, ['m', 'a', 'o', 'w'])).toBeGreaterThan(24);
    expect(regionTokenCount(squirrel, 14, 2, 20, 17, ['m', 'h'])).toBeGreaterThan(18);
    expect(regionTokenCount(dog, 2, 5, 18, 15, ['a', 'h', 'e'])).toBeGreaterThan(26);
  });

  it('gives every hero animal a dedicated stage band without changing compact avatars', () => {
    for (const code of BUDDY_CODES) {
      const hero = resolvePixelBuddyDisplayFrame(code, 8, 'hero');
      const compact = resolvePixelBuddyDisplayFrame(code, 8, 'compact');
      const stageBand = hero.slice(29, 36).join('');
      const litStageCells = Array.from(stageBand).filter((token) => ['w', 'h', 'o', 'a', 'm'].includes(token)).length;

      expect(litStageCells).toBeGreaterThan(18);
      expect(compact).toHaveLength(getPixelBuddySpriteDimensions('compact').height * 2);
      expect(compact.every((line) => line.length === getPixelBuddySpriteDimensions('compact').width)).toBe(true);
    }
  });

  it('keeps the six animal silhouettes distinct', () => {
    const solidCellsByCode = new Map(
      BUDDY_CODES.map((code) => [code, solidCellIndexes(resolvePixelBuddyFrame(code, 0))]),
    );
    const restingFrames = new Set(BUDDY_CODES.map((code) => resolvePixelBuddyFrame(code, 0).join('\n')));

    expect(restingFrames.size).toBe(BUDDY_CODES.length);

    for (let left = 0; left < BUDDY_CODES.length; left += 1) {
      for (let right = left + 1; right < BUDDY_CODES.length; right += 1) {
        const leftCells = solidCellsByCode.get(BUDDY_CODES[left]) ?? new Set<number>();
        const rightCells = solidCellsByCode.get(BUDDY_CODES[right]) ?? new Set<number>();

        expect(overlapRatio(leftCells, rightCells)).toBeLessThan(0.9);
      }
    }
  });

  it('uses stable per-animal color identities in the real TUI palette', () => {
    const theme = buildResolvedTuiTheme('transparent');
    const signatures = new Set(
      BUDDY_CODES.map((code) => {
        const palette = resolvePixelBuddyPalette(code, theme);
        return [palette.m, palette.o, palette.a].join('|');
      }),
    );

    expect(signatures.size).toBe(BUDDY_CODES.length);
    for (const code of BUDDY_CODES) {
      const palette = resolvePixelBuddyPalette(code, theme);

      expect(palette['.']).toBe(theme.semantic.fill.grouped);
      expect(palette.g).toBe(theme.semantic.separator);
      expect([palette.m, palette.o, palette.a]).not.toEqual([
        theme.semantic.tintMuted,
        theme.semantic.tint,
        theme.semantic.activity,
      ]);
    }
  });

  it('exposes the actual hero and compact matrices used by the renderer', () => {
    const hero = resolvePixelBuddyDisplayFrame('ARC', 0, 'hero');
    const compact = resolvePixelBuddyDisplayFrame('ARC', 0, 'compact');
    const heroDimensions = getPixelBuddySpriteDimensions('hero');
    const compactDimensions = getPixelBuddySpriteDimensions('compact');

    expect(heroDimensions).toEqual({ width: 36, height: 18 });
    expect(compactDimensions).toEqual({ width: 20, height: 10 });
    expect(hero).toHaveLength(heroDimensions.height * 2);
    expect(hero.every((line) => line.length === heroDimensions.width)).toBe(true);
    expect(compact).toHaveLength(compactDimensions.height * 2);
    expect(compact.every((line) => line.length === compactDimensions.width)).toBe(true);
  });

  it('keeps the compact timeline avatars visually distinct after sampling', () => {
    const compactCellsByCode = new Map(
      BUDDY_CODES.map((code) => [code, solidCellIndexes(resolvePixelBuddyDisplayFrame(code, 0, 'compact'))]),
    );
    const compactFrames = new Set(BUDDY_CODES.map((code) => resolvePixelBuddyDisplayFrame(code, 0, 'compact').join('\n')));

    expect(compactFrames.size).toBe(BUDDY_CODES.length);
    for (let left = 0; left < BUDDY_CODES.length; left += 1) {
      for (let right = left + 1; right < BUDDY_CODES.length; right += 1) {
        const leftCells = compactCellsByCode.get(BUDDY_CODES[left]) ?? new Set<number>();
        const rightCells = compactCellsByCode.get(BUDDY_CODES[right]) ?? new Set<number>();

        expect(overlapRatio(leftCells, rightCells)).toBeLessThan(0.94);
      }
    }
  });
});

function solidCellIndexes(frame: readonly string[]): Set<number> {
  const indexes = new Set<number>();
  Array.from(frame.join('')).forEach((token, index) => {
    if (token !== '.' && token !== 'g') indexes.add(index);
  });
  return indexes;
}

function overlapRatio(left: ReadonlySet<number>, right: ReadonlySet<number>): number {
  const smaller = Math.min(left.size, right.size);
  if (smaller === 0) return 0;
  let overlap = 0;
  for (const index of left) {
    if (right.has(index)) overlap += 1;
  }
  return overlap / smaller;
}

function frameDiff(left: readonly string[], right: readonly string[]): number {
  const leftText = left.join('');
  const rightText = right.join('');
  const length = Math.max(leftText.length, rightText.length);
  let diff = 0;
  for (let index = 0; index < length; index += 1) {
    if (leftText[index] !== rightText[index]) diff += 1;
  }
  return diff;
}

function regionTokenCount(
  frame: readonly string[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  tokens: readonly string[],
): number {
  const tokenSet = new Set(tokens);
  let count = 0;
  for (let y = minY; y < maxY; y += 1) {
    const row = Array.from(frame[y] ?? '');
    for (let x = minX; x < maxX; x += 1) {
      if (tokenSet.has(row[x] ?? '.')) count += 1;
    }
  }
  return count;
}
