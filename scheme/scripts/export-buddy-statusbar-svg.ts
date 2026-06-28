import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  BUDDY_CREST_COLORWAYS,
  BUDDY_CREST_DESIGN,
  INTENT_BUDDY_COLUMNS,
  resolveBuddyCrestSurfaceBackgroundColor,
  resolveBuddyGlyphTone,
  resolveInlineBuddyCrest,
  type BuddyCrestPalette,
  type BuddyGlyphTone,
} from '../src/app/ui/flow/BuddyStrip';
import { resolveBuddyProfileFromIntent, type BuddyProfile, type BuddyTypeCode } from '../src/app/observer/view-model/buddy-profile';
import { INTENT_BUDDY_PREVIEW_ITEMS, type IntentBuddyPreviewItem } from './buddy-preview-items';

const OUTPUT_ARG = '--out=';
const SHEET_WIDTH = 1280;
const MARGIN = 30;
const ROW_WIDTH = SHEET_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 120;
const ROW_GAP = 18;
const CHAR_WIDTH = 12;
const META_Y = 26;
const INTENT_Y = 56;
const CREST_ROW_GAP = 23;
const BUDDY_X = 26;
const BUDDY_CELL_WIDTH = 13;
const BUDDY_CELL_HEIGHT = 24;
const BUDDY_TITLE_GAP = 22;

export interface BuddyStatusBarPreviewRow extends IntentBuddyPreviewItem {
  profile: BuddyProfile;
}

function main(): Promise<void> {
  const outputPath = resolve(process.cwd(), getOutputPath(process.argv.slice(2)));
  return writeFile(outputPath, renderBuddyStatusBarSvg())
    .then(() => console.log(`wrote ${outputPath}`));
}

export function renderBuddyStatusBarSvg(): string {
  const previewRows = resolveBuddyStatusBarPreviewRows();
  const height = MARGIN * 2 + previewRows.length * ROW_HEIGHT + (previewRows.length - 1) * ROW_GAP;
  const rows = previewRows
    .map((row, index) => renderStatusBarRow(row, MARGIN, MARGIN + index * (ROW_HEIGHT + ROW_GAP)))
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${height}" viewBox="0 0 ${SHEET_WIDTH} ${height}">`,
    '<rect width="100%" height="100%" fill="#0b0e14"/>',
    rows,
    '</svg>\n',
  ].join('');
}

export function resolveBuddyStatusBarPreviewRows(): readonly BuddyStatusBarPreviewRow[] {
  return INTENT_BUDDY_PREVIEW_ITEMS.flatMap((item) => {
    const profile = resolveBuddyProfileFromIntent(item.intentKey, 'en');
    return profile ? [{ ...item, profile }] : [];
  });
}

function renderStatusBarRow(row: BuddyStatusBarPreviewRow, x: number, y: number): string {
  const { profile } = row;
  const code = profile.code;
  const design = BUDDY_CREST_DESIGN[code];
  const badgeX = x + BUDDY_X + INTENT_BUDDY_COLUMNS * BUDDY_CELL_WIDTH + BUDDY_TITLE_GAP;
  const titleX = badgeX + (row.badge.length + 4) * CHAR_WIDTH;
  const textY = y + INTENT_Y + CREST_ROW_GAP;

  return [
    `<g data-statusbar-buddy="${code}" data-statusbar-intent="${profile.intentKey}">`,
    `<rect x="${x}" y="${y}" width="${ROW_WIDTH}" height="${ROW_HEIGHT}" rx="12" fill="#121722" stroke="#263149"/>`,
    `<text x="${x + 22}" y="${y + META_Y}" fill="#7f89ad" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="17">Timeline · qwen3.6-flash · ${design.intentSignal}</text>`,
    renderBuddyGlyphRow(code, profile.intentKey, x + BUDDY_X, y + INTENT_Y),
    `<text x="${badgeX}" y="${textY}" fill="#637097" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="19">「</text>`,
    `<text x="${badgeX + CHAR_WIDTH}" y="${textY}" fill="#66e8ff" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="19" font-weight="700">${row.badge}</text>`,
    `<text x="${badgeX + (row.badge.length + 1) * CHAR_WIDTH}" y="${textY}" fill="#637097" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="19">」</text>`,
    `<text x="${titleX}" y="${textY}" fill="#c8d2f2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="19">${escapeXml(row.title)}</text>`,
    '</g>',
  ].join('');
}

function renderBuddyGlyphRow(code: BuddyTypeCode, intentKey: string, x: number, baselineY: number): string {
  const rows = resolveInlineBuddyCrest(code, 0, intentKey).rows;
  const palette = resolvePreviewPalette(code);
  const baseX = x;
  const baseY = baselineY - 20;
  const baseWidth = INTENT_BUDDY_COLUMNS * BUDDY_CELL_WIDTH;
  const baseHeight = rows.length * CREST_ROW_GAP + 1;
  const glyphs = rows.flatMap((row, rowIndex) => Array.from(row).map((char, index) => {
    const tone = resolveBuddyGlyphTone(char);
    const cellX = x + index * BUDDY_CELL_WIDTH;
    const rowBaselineY = baselineY + rowIndex * CREST_ROW_GAP;
    const cellY = rowBaselineY - 20;
    const weight = tone === 'eye' || tone === 'spark' ? 700 : 500;
    const highlight = tone === 'eye' || tone === 'spark'
      ? `<rect x="${cellX}" y="${cellY}" width="${BUDDY_CELL_WIDTH}" height="${BUDDY_CELL_HEIGHT}" rx="4" fill="${palette.focusBg}"/>`
      : '';

    return [
      highlight,
      `<text x="${cellX + BUDDY_CELL_WIDTH / 2}" y="${rowBaselineY}" fill="${colorForTone(code, tone)}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" font-weight="${weight}">${escapeXml(char)}</text>`,
    ].join('');
  }));

  return [
    `<g data-row="${escapeXml(rows.join('/'))}">`,
    `<rect x="${baseX}" y="${baseY}" width="${baseWidth}" height="${baseHeight}" rx="8" fill="${resolveBuddyCrestSurfaceBackgroundColor(0, palette)}" opacity="0.46"/>`,
    glyphs.join(''),
    '</g>',
  ].join('');
}

function resolvePreviewPalette(code: BuddyTypeCode): BuddyCrestPalette {
  return {
    baseBg: '#0b0e14',
    ...BUDDY_CREST_COLORWAYS[code],
  };
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

function getOutputPath(args: readonly string[]): string {
  const explicit = args.find((arg) => arg.startsWith(OUTPUT_ARG));
  return explicit ? explicit.slice(OUTPUT_ARG.length) : '/tmp/gui-anything-buddy-statusbar.svg';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (import.meta.main) {
  await main();
}
