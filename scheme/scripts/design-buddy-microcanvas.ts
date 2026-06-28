/**
 * Braille micro-canvas workbench for intent buddy crests.
 *
 * The production intent bar must stay one terminal row high. Braille gives each
 * terminal cell a 2x4 dot grid, so this script is a design-time helper for
 * choosing contour cells without adding a second runtime to the OpenTUI path.
 */

import {
  BUDDY_BRAILLE_CONTOUR_CHARS,
  BUDDY_CREST_PREVIEW_MOTION_FRAMES,
  resolveInlineBuddyCrest,
} from '../src/app/ui/flow/BuddyStrip';
import { BUDDY_TYPE_CODES } from '../src/app/observer/view-model/buddy-profile';

const BRAILLE_BASE = 0x2800;
const DOT_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
] as const;

function main(): void {
  console.log('Braille contour vocabulary');
  for (const char of Array.from(BUDDY_BRAILLE_CONTOUR_CHARS)) {
    console.log(`${char}  ${renderBrailleCell(char).join(' / ')}`);
  }

  console.log('\nIntent crest motion sheet');
  for (const code of BUDDY_TYPE_CODES) {
    const frames = BUDDY_CREST_PREVIEW_MOTION_FRAMES
      .map((frame) => resolveInlineBuddyCrest(code, frame).rows.join('/'))
      .join('  ');
    console.log(`${code.padEnd(4)} ${frames}`);
  }
}

export function renderBrailleCell(char: string): readonly string[] {
  const value = char.codePointAt(0);
  if (typeof value !== 'number' || value < BRAILLE_BASE || value > 0x28ff) {
    return ['??', '??', '??', '??'];
  }

  const bits = value - BRAILLE_BASE;
  return DOT_BITS.map((row) => row
    .map((bit) => (bits & bit) === bit ? '●' : '·')
    .join(''));
}

if (import.meta.main) {
  main();
}
