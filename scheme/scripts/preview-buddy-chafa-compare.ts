/**
 * Compare the runtime intent-bar glyphs with Chafa-compressed 20x3 slots.
 *
 * Chafa is useful as a design pressure test, but the runtime status bar keeps
 * curated glyphs so animal identity survives the final 20-column footprint.
 */

import { resolveInlineBuddyCrest } from '../src/app/ui/flow/BuddyStrip';
import { BUDDY_TYPE_CODES, type BuddyTypeCode } from '../src/app/observer/view-model/buddy-profile';
import {
  formatBuddyChafaSlots,
  renderGeneratedBuddyChafaSlots,
  renderBuddyChafaSlotsFromImageDir,
  type BuddyChafaSlot,
} from './export-buddy-chafa-ansi';

const IMAGE_DIR_ARG = '--image-dir=';
const BUDDY_TO_ANIMAL: Record<BuddyTypeCode, BuddyChafaSlot['kind']> = {
  ARC: 'owl',
  VIB: 'butterfly',
  DBG: 'fox',
  SHIP: 'swallow',
  CUR: 'squirrel',
  EXP: 'dog',
};

const HEADER = 'Buddy intent-bar review · runtime glyph vs Chafa 20x3 slot';
const GLYPH_LABEL = 'runtime glyph';
const CHAFA_LABEL = 'chafa slot';

async function main(): Promise<void> {
  const imageDir = readValueArg(process.argv.slice(2), IMAGE_DIR_ARG);
  const text = await renderBuddyChafaComparison({ imageDir });
  process.stdout.write(text);
}

export interface BuddyChafaComparisonOptions {
  imageDir?: string;
}

export async function renderBuddyChafaComparison(options: BuddyChafaComparisonOptions = {}): Promise<string> {
  const slots = options.imageDir
    ? await renderBuddyChafaSlotsFromImageDir(options.imageDir, { symbols: 'border+block+space' })
    : await renderGeneratedBuddyChafaSlots({ symbols: 'border+block+space' });
  const slotByKind = new Map(slots.map((slot) => [slot.kind, slot.text]));
  const sourceLabel = options.imageDir ? `image2 source: ${options.imageDir}` : 'generated fallback source';
  const sections = BUDDY_TYPE_CODES.map((code) => {
    const runtimeRows = resolveInlineBuddyCrest(code, 0).rows;
    const chafaRows = (slotByKind.get(BUDDY_TO_ANIMAL[code]) ?? '').split('\n');
    const title = `${code} · ${BUDDY_TO_ANIMAL[code]}`;
    const rows = runtimeRows.map((row, index) =>
      `${row}  │  ${chafaRows[index]?.padEnd(20, ' ') ?? ' '.repeat(20)}`,
    );

    return [
      title,
      `${GLYPH_LABEL.padEnd(20, ' ')}  │  ${CHAFA_LABEL}`,
      ...rows,
    ].join('\n');
  });

  return [
    HEADER,
    sourceLabel,
    '',
    ...sections,
    '',
    'raw chafa slots',
    formatBuddyChafaSlots(slots).trimEnd(),
    '',
  ].join('\n');
}

function readValueArg(args: readonly string[], prefix: string): string | undefined {
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

if (import.meta.main) {
  await main();
}
