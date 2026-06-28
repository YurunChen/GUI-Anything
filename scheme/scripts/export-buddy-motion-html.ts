import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  BUDDY_CREST_COLORWAYS,
  BUDDY_CREST_DESIGN,
  BUDDY_CREST_PREVIEW_MOTION_FRAMES,
  INTENT_BUDDY_COLUMNS,
  INTENT_BUDDY_ROWS,
  resolveBuddyCrestSurfaceBackgroundColor,
  resolveBuddyGlyphTone,
  resolveInlineBuddyCrest,
  type BuddyCrestPalette,
  type BuddyGlyphTone,
} from '../src/app/ui/flow/BuddyStrip';
import {
  resolveBuddyProfileFromIntent,
  type BuddyProfile,
  type BuddyTypeCode,
} from '../src/app/observer/view-model/buddy-profile';
import { INTENT_BUDDY_PREVIEW_ITEMS, type IntentBuddyPreviewItem } from './buddy-preview-items';

const OUTPUT_ARG = '--out=';

const TONE_CLASS: Record<BuddyGlyphTone, string> = {
  frame: 'tone-frame',
  eye: 'tone-eye',
  spark: 'tone-spark',
  accent: 'tone-accent',
  outline: 'tone-outline',
};

export interface BuddyMotionPreviewRow extends IntentBuddyPreviewItem {
  profile: BuddyProfile;
}

async function main(): Promise<void> {
  const outputPath = resolve(process.cwd(), getOutputPath(process.argv.slice(2)));
  await writeFile(outputPath, renderBuddyMotionHtml());
  console.log(`wrote ${outputPath}`);
}

export function renderBuddyMotionHtml(): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    '<title>GUI-Anything Buddy Motion Preview</title>',
    '<style>',
    renderStyles(),
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '<header>',
    '<p class="eyebrow">GUI-Anything · intent buddy motion</p>',
    '<h1>Compact three-row animals, real status-bar rhythm</h1>',
    '<p class="note">Each row loops the same four crest frames used by the OpenTUI intent bar: stable, blink, lift, pulse.</p>',
    '</header>',
    '<section class="rows">',
    resolveBuddyMotionPreviewRows().map(renderMotionRow).join(''),
    '</section>',
    '</main>',
    '</body>',
    '</html>\n',
  ].join('');
}

export function resolveBuddyMotionPreviewRows(): readonly BuddyMotionPreviewRow[] {
  return INTENT_BUDDY_PREVIEW_ITEMS.flatMap((item) => {
    const profile = resolveBuddyProfileFromIntent(item.intentKey, 'en');
    return profile ? [{ ...item, profile }] : [];
  });
}

function renderMotionRow(row: BuddyMotionPreviewRow): string {
  const { profile } = row;
  const code = profile.code;
  const design = BUDDY_CREST_DESIGN[code];
  const frames = BUDDY_CREST_PREVIEW_MOTION_FRAMES
    .map((motionFrame, index) => renderMotionFrame(profile, motionFrame, index))
    .join('');

  return [
    `<article class="status-row" data-motion-buddy="${code}" data-motion-intent="${escapeHtml(profile.intentKey)}">`,
    '<div class="meta">',
    `<span>Timeline</span><span>qwen3.6-flash</span><span>${escapeHtml(design.intentSignal)}</span>`,
    '</div>',
    '<div class="intent-line">',
    `<div class="buddy-motion" aria-label="${escapeHtml(design.animal)}" style="--buddy-focus:${BUDDY_CREST_COLORWAYS[code].focusBg};">${frames}</div>`,
    '<div class="intent-copy">',
    `<span class="bracket">「</span><span class="badge">${row.badge}</span><span class="bracket">」</span>`,
    `<span class="title">${escapeHtml(row.title)}</span>`,
    '</div>',
    '</div>',
    '</article>',
  ].join('');
}

function renderMotionFrame(profile: BuddyProfile, motionFrame: number, index: number): string {
  const rows = resolveInlineBuddyCrest(profile.code, motionFrame, profile.intentKey).rows;
  const palette = resolvePreviewPalette(profile.code);
  const background = resolveBuddyCrestSurfaceBackgroundColor(motionFrame, palette);
  const glyphRows = rows
    .map((row) => {
      const glyphs = Array.from(row).map((char) => {
        const tone = resolveBuddyGlyphTone(char);
        return `<span class="glyph ${TONE_CLASS[tone]}" style="color:${colorForTone(profile.code, tone)};">${escapeHtml(char)}</span>`;
      })
        .join('');
      return `<div class="crest-row">${glyphs}</div>`;
    })
    .join('');

  return `<div class="motion-frame frame-${index}" data-frame="${motionFrame}" data-row="${escapeHtml(rows.join('/'))}" style="--buddy-bed:${background};">${glyphRows}</div>`;
}

function renderStyles(): string {
  return `
:root {
  color-scheme: dark;
  --bg: #090c12;
  --surface: #121722;
  --surface-2: #151d2c;
  --line: #263149;
  --muted: #7f89ad;
  --text: #c8d2f2;
  --badge: #66e8ff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(circle at top left, #152235 0, var(--bg) 42rem);
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
main {
  width: min(1180px, calc(100vw - 48px));
  margin: 34px auto;
}
header { margin-bottom: 22px; }
.eyebrow {
  margin: 0 0 8px;
  color: var(--badge);
  letter-spacing: 0;
}
h1 {
  margin: 0 0 10px;
  font-size: 30px;
  line-height: 1.2;
  letter-spacing: 0;
}
.note {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}
.rows {
  display: grid;
  gap: 16px;
}
.status-row {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 92%, #233456);
  padding: 14px 20px 16px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.24);
}
.meta {
  display: flex;
  gap: 14px;
  color: var(--muted);
  font-size: 15px;
  margin-bottom: 12px;
}
.meta span + span::before {
  content: "·";
  margin-right: 14px;
  color: #465171;
}
.intent-line {
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 62px;
}
.buddy-motion {
  position: relative;
  width: ${INTENT_BUDDY_COLUMNS * 13}px;
  height: ${INTENT_BUDDY_ROWS * 28}px;
  flex: 0 0 ${INTENT_BUDDY_COLUMNS * 13}px;
  border-radius: 10px;
  overflow: hidden;
}
.motion-frame {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  opacity: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--buddy-bed) 58%, transparent);
  animation: buddy-step 1600ms steps(1, end) infinite;
}
.crest-row {
  display: grid;
  grid-template-columns: repeat(${INTENT_BUDDY_COLUMNS}, 13px);
}
.frame-0 { animation-delay: 0ms; }
.frame-1 { animation-delay: -1200ms; }
.frame-2 { animation-delay: -800ms; }
.frame-3 { animation-delay: -400ms; }
.glyph {
  width: 13px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: transparent;
  font-size: 18px;
  line-height: 1;
}
.tone-eye {
  font-weight: 700;
  background: var(--buddy-focus);
}
.tone-spark {
  font-weight: 700;
  background: var(--buddy-focus);
}
.intent-copy {
  display: flex;
  align-items: baseline;
  min-width: 0;
  font-size: 19px;
}
.bracket { color: #637097; }
.badge {
  color: var(--badge);
  font-weight: 700;
}
.title {
  color: var(--text);
  margin-left: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@keyframes buddy-step {
  0%, 24.99% { opacity: 1; }
  25%, 100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .motion-frame { animation: none; }
  .frame-0 { opacity: 1; }
}
`;
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

function resolvePreviewPalette(code: BuddyTypeCode): BuddyCrestPalette {
  return {
    baseBg: '#090c12',
    ...BUDDY_CREST_COLORWAYS[code],
  };
}

function getOutputPath(args: readonly string[]): string {
  const explicit = args.find((arg) => arg.startsWith(OUTPUT_ARG));
  return explicit ? explicit.slice(OUTPUT_ARG.length) : '/tmp/gui-anything-buddy-motion.html';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (import.meta.main) {
  await main();
}
