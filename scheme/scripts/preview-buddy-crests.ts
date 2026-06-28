/**
 * Preview intent buddy crests in a terminal-like status-bar context.
 *
 *   bun run preview:buddy
 *   bun run preview:buddy -- --no-color
 *
 * This is a developer visual check only. Product rendering stays in the
 * OpenTUI components; this script reuses the same view helpers so the preview
 * cannot drift into a separate source of truth.
 */

import {
  BUDDY_CREST_PREVIEW_MOTION_FRAMES,
  resolveBuddyGlyphTone,
  resolveInlineBuddyCrest,
  resolveLineBuddyAvatar,
} from '../src/app/ui/flow/BuddyStrip';
import {
  BUDDY_TYPE_CODES,
  resolveBuddyProfileFromIntent,
} from '../src/app/observer/view-model/buddy-profile';
import { lineDisplayWidth, truncateFlowText } from '../src/utils/flow-text';
import { INTENT_BUDDY_PREVIEW_ITEMS } from './buddy-preview-items';

const RESET = '\x1b[0m';
const ANSI = {
  frame: '\x1b[38;5;153m',
  eye: '\x1b[1;38;5;228m',
  spark: '\x1b[1;38;5;219m',
  accent: '\x1b[38;5;117m',
  outline: '\x1b[38;5;146m',
  muted: '\x1b[38;5;245m',
  title: '\x1b[38;5;189m',
  badge: '\x1b[38;5;123m',
};

function main(): void {
  const color = shouldUseColor(process.argv.slice(2));
  const width = readWidth(process.argv.slice(2));

  printLine('Intent buddy in status bar', color, width);
  for (const item of INTENT_BUDDY_PREVIEW_ITEMS) {
    const profile = resolveBuddyProfileFromIntent(item.intentKey, 'en');
    if (!profile) continue;
    const crestRows = resolveInlineBuddyCrest(profile.code, 0, profile.intentKey).rows;
    const titleBudget = Math.max(12, width - lineDisplayWidth(crestRows[0] ?? '') - item.badge.length - 8);
    const row = [
      colorizeCrest(crestRows[0] ?? '', color),
      `${colorText('「', 'muted', color)}${colorText(item.badge, 'badge', color)}${colorText('」', 'muted', color)}`,
      colorText(truncateFlowText(item.title, titleBudget), 'title', color),
    ].join(' ');
    console.log(row);
    for (const crestRow of crestRows.slice(1)) {
      console.log(colorizeCrest(crestRow, color));
    }
  }

  printLine('Motion storyboard', color, width);
  for (const item of INTENT_BUDDY_PREVIEW_ITEMS) {
    const profile = resolveBuddyProfileFromIntent(item.intentKey, 'en');
    if (!profile) continue;
    const frames = BUDDY_CREST_PREVIEW_MOTION_FRAMES
      .map((frame) =>
        resolveInlineBuddyCrest(profile.code, frame, profile.intentKey)
          .rows
          .map((row) => colorizeCrest(row, color))
          .join('/'),
      )
      .join(colorText('  ', 'muted', color));
    console.log(`${colorText(item.badge.padEnd(8), 'badge', color)} ${frames}`);
  }

  printLine('Timeline marker silhouettes', color, width);
  for (const code of BUDDY_TYPE_CODES) {
    console.log(colorText(code, 'badge', color));
    for (const row of resolveLineBuddyAvatar(code, 0).rows) {
      console.log(colorText(row, 'accent', color));
    }
  }
}

function shouldUseColor(argv: string[]): boolean {
  if (argv.includes('--no-color') || process.env.NO_COLOR) return false;
  return process.stdout.isTTY;
}

function readWidth(argv: string[]): number {
  const explicit = argv.find((arg) => arg.startsWith('--width='));
  if (!explicit) return Number(process.stdout.columns || 96);
  const parsed = Number(explicit.slice('--width='.length));
  return Number.isFinite(parsed) ? Math.max(48, Math.floor(parsed)) : 96;
}

function printLine(title: string, color: boolean, width: number): void {
  const label = ` ${title} `;
  const tail = '─'.repeat(Math.max(0, width - lineDisplayWidth(label)));
  console.log(`\n${colorText(label, 'muted', color)}${colorText(tail, 'muted', color)}`);
}

function colorizeCrest(crest: string, color: boolean): string {
  if (!color) return crest;
  return Array.from(crest)
    .map((char) => colorText(char, resolveBuddyGlyphTone(char), true))
    .join('');
}

function colorText(text: string, tone: keyof typeof ANSI | ReturnType<typeof resolveBuddyGlyphTone>, color: boolean): string {
  if (!color || !text) return text;
  return `${ANSI[tone]}${text}${RESET}`;
}

void main();
