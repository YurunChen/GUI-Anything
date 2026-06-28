import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  BUDDY_CREST_COLORWAYS,
  BUDDY_CREST_DESIGN,
  BUDDY_CREST_PREVIEW_MOTION_FRAMES,
  INTENT_BUDDY_COLUMNS,
  resolveBuddyGlyphTone,
  resolveInlineBuddyCrest,
  type BuddyGlyphTone,
} from '../src/app/ui/flow/BuddyStrip';
import {
  resolveBuddyProfileFromIntent,
  type BuddyProfile,
  type BuddyTypeCode,
} from '../src/app/observer/view-model/buddy-profile';
import { INTENT_BUDDY_PREVIEW_ITEMS, type IntentBuddyPreviewItem } from './buddy-preview-items';

const OUTPUT_ARG = '--out=';
const CELL_WIDTH = 14;
const CELL_HEIGHT = 28;
const CARD_WIDTH = 1400;
const CARD_HEIGHT = 164;
const CARD_GAP = 24;
const MARGIN = 32;
const FRAME_GAP = 36;
const CREST_X = 236;
const CREST_Y = 70;
const CREST_ROW_GAP = 30;
const SHEET_WIDTH = CARD_WIDTH + MARGIN * 2;

const ANIMAL_DISPLAY: Record<BuddyTypeCode, string> = {
  ARC: 'owl',
  VIB: 'butterfly',
  DBG: 'fox',
  SHIP: 'swallow',
  CUR: 'squirrel',
  EXP: 'dog',
};

async function main(): Promise<void> {
  const outputPath = resolve(process.cwd(), getOutputPath(process.argv.slice(2)));
  await writeFile(outputPath, renderBuddyCrestSvg());

  console.log(`wrote ${outputPath}`);
  for (const item of resolveIntentBuddyDesignItems()) {
    console.log(`${item.badge.padEnd(8)} ${item.profile.code} ${item.profile.intentKey} ${item.frames[0].join('/')}`);
  }
}

export function renderBuddyCrestSvg(): string {
  const items = resolveIntentBuddyDesignItems();
  const height = MARGIN * 2 + items.length * CARD_HEIGHT + (items.length - 1) * CARD_GAP;
  const rows = items.map((item, index) => renderBuddyCard(item, MARGIN, MARGIN + index * (CARD_HEIGHT + CARD_GAP)));

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="',
    String(SHEET_WIDTH),
    '" height="',
    String(height),
    '" viewBox="0 0 ',
    String(SHEET_WIDTH),
    ' ',
    String(height),
    '">',
    '<rect width="100%" height="100%" fill="#0d1018"/>',
    '<text x="32" y="30" fill="#c9d5ff" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">GUI-Anything Intent Buddy Crest Sheet · real intent variants</text>',
    rows.join(''),
    '</svg>\n',
  ].join('');
}

export interface IntentBuddyDesignItem extends IntentBuddyPreviewItem {
  profile: BuddyProfile;
  frames: readonly (readonly string[])[];
}

export function resolveIntentBuddyDesignItems(): readonly IntentBuddyDesignItem[] {
  return INTENT_BUDDY_PREVIEW_ITEMS.flatMap((item) => {
    const profile = resolveBuddyProfileFromIntent(item.intentKey, 'en');
    if (!profile) return [];
    return [{
      ...item,
      profile,
      frames: BUDDY_CREST_PREVIEW_MOTION_FRAMES
        .map((motionFrame) => resolveInlineBuddyCrest(profile.code, motionFrame, profile.intentKey).rows),
    }];
  });
}

function renderBuddyCard(item: IntentBuddyDesignItem, x: number, y: number): string {
  const { profile } = item;
  const code = profile.code;
  const design = BUDDY_CREST_DESIGN[code];
  const frames = BUDDY_CREST_PREVIEW_MOTION_FRAMES
    .map((motionFrame, frameIndex) =>
      renderCrestFrame(
        profile,
        motionFrame,
        x + CREST_X + frameIndex * (CELL_WIDTH * INTENT_BUDDY_COLUMNS + FRAME_GAP),
        y + CREST_Y,
      ),
    );

  return [
    `<g data-buddy="${code}" data-intent="${escapeXml(profile.intentKey)}">`,
    `<rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="18" fill="#151a26" stroke="#2a344d"/>`,
    `<text x="${x + 28}" y="${y + 42}" fill="#78f4d2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22" font-weight="700">${escapeXml(item.badge)}</text>`,
    `<text x="${x + 28}" y="${y + 72}" fill="#f4f7ff" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">${code} · ${escapeXml(ANIMAL_DISPLAY[code])}</text>`,
    `<text x="${x + 28}" y="${y + 101}" fill="#8d96bd" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16">${escapeXml(design.intentSignal)}</text>`,
    `<text x="${x + 28}" y="${y + 128}" fill="#6f789a" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14">${escapeXml(item.intentKey)}</text>`,
    frames.join(''),
    '</g>',
  ].join('');
}

function renderCrestFrame(profile: BuddyProfile, motionFrame: number, x: number, y: number): string {
  const rows = resolveInlineBuddyCrest(profile.code, motionFrame, profile.intentKey).rows;
  const glyphs = rows.flatMap((row, rowIndex) => Array.from(row).map((char, index) => {
    const tone = resolveBuddyGlyphTone(char);
    const weight = tone === 'eye' || tone === 'spark' ? 700 : 500;
    const color = colorForTone(profile.code, tone);
    const baselineY = y + rowIndex * CREST_ROW_GAP;

    return [
      `<rect x="${x + index * CELL_WIDTH}" y="${baselineY - 22}" width="${CELL_WIDTH}" height="${CELL_HEIGHT}" rx="6" fill="${backgroundForTone(profile.code, tone)}"/>`,
      `<text x="${x + index * CELL_WIDTH + CELL_WIDTH / 2}" y="${baselineY}" fill="${color}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="19" font-weight="${weight}">${escapeXml(char)}</text>`,
    ].join('');
  }));

  return `<g data-frame="${motionFrame}" data-row="${escapeXml(rows.join('/'))}">${glyphs.join('')}</g>`;
}

function getOutputPath(args: readonly string[]): string {
  const explicit = args.find((arg) => arg.startsWith(OUTPUT_ARG));
  return explicit ? explicit.slice(OUTPUT_ARG.length) : '/tmp/gui-anything-buddy-crests.svg';
}

function backgroundForTone(code: BuddyTypeCode, tone: BuddyGlyphTone): string {
  const colorway = BUDDY_CREST_COLORWAYS[code];
  switch (tone) {
    case 'frame':
      return colorway.frameBg;
    case 'eye':
    case 'spark':
      return colorway.focusBg;
    case 'accent':
    case 'outline':
      return '#101521';
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colorForTone(code: BuddyTypeCode, tone: BuddyGlyphTone): string {
  const colorway = BUDDY_CREST_COLORWAYS[code];
  switch (tone) {
    case 'frame':
      return colorway.frameFg;
    case 'eye':
      return colorway.eyeFg;
    case 'spark':
      return colorway.sparkFg;
    case 'accent':
      return colorway.accentFg;
    case 'outline':
      return colorway.outlineFg;
  }
}

if (import.meta.main) {
  await main();
}
