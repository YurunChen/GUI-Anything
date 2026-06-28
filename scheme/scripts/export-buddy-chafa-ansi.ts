import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import Chafa from 'chafa-wasm';
import {
  BUDDY_ANIMAL_SOURCES,
  BUDDY_ANIMAL_IMAGE_DIR,
  type BuddyAnimalKind,
} from './buddy-animal-sources';

const OUTPUT_ARG = '--out=';
const IMAGE_ARG = '--image=';
const IMAGE_DIR_ARG = '--image-dir=';
const WIDTH_ARG = '--width=';
const HEIGHT_ARG = '--height=';
const SYMBOLS_ARG = '--symbols=';
const PLAIN_ARG = '--plain';
const SLOTS_ARG = '--slots';
const SLOT_COLUMNS = 20;
const SLOT_ROWS = 3;

export interface BuddyChafaOptions {
  width?: number;
  height?: number;
  plain?: boolean;
  symbols?: string;
}

export interface BuddyChafaSlot {
  kind: BuddyAnimalKind;
  text: string;
}

interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const PALETTE = {
  bg: [8, 11, 18, 255],
  cyan: [102, 232, 255, 255],
  blue: [138, 169, 214, 255],
  violet: [183, 156, 255, 255],
  gold: [255, 209, 102, 255],
  green: [134, 239, 172, 255],
  orange: [255, 155, 115, 255],
  white: [243, 247, 255, 255],
} as const;

const BUDDY_ROWS: readonly {
  kind: BuddyAnimalKind;
  accent: readonly number[];
}[] = [
  { kind: 'dog', accent: PALETTE.cyan },
  { kind: 'owl', accent: PALETTE.blue },
  { kind: 'swallow', accent: PALETTE.green },
  { kind: 'butterfly', accent: PALETTE.violet },
  { kind: 'fox', accent: PALETTE.orange },
  { kind: 'squirrel', accent: PALETTE.gold },
] as const;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputPath = readValueArg(args, OUTPUT_ARG);
  const imagePath = readValueArg(args, IMAGE_ARG);
  const imageDir = readValueArg(args, IMAGE_DIR_ARG);
  const ansi = args.includes(SLOTS_ARG)
    ? await (imageDir
        ? renderBuddyChafaSlotsFromImageDir(imageDir, readOptions(args))
        : renderGeneratedBuddyChafaSlots(readOptions(args))
      ).then(formatBuddyChafaSlots)
    : imagePath
      ? await renderBuddyChafaAnsiFromFile(imagePath, readOptions(args))
      : await renderGeneratedBuddyChafaAnsi(readOptions(args));

  if (outputPath) {
    await writeFile(outputPath, ansi);
    console.log(`wrote ${outputPath}`);
    return;
  }

  process.stdout.write(ansi);
}

export async function renderBuddyChafaAnsiFromFile(
  imagePath: string,
  options: BuddyChafaOptions = {},
): Promise<string> {
  const image = await readFile(imagePath);
  return imageToChafaAnsi(
    image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength),
    options,
  );
}

export async function renderGeneratedBuddyChafaAnsi(options: BuddyChafaOptions = {}): Promise<string> {
  return imageToChafaAnsi(createBuddyDesignImageData(), options);
}

export async function renderGeneratedBuddyChafaSlots(options: BuddyChafaOptions = {}): Promise<readonly BuddyChafaSlot[]> {
  const slotOptions = {
    ...options,
    width: options.width ?? SLOT_COLUMNS,
    height: options.height ?? SLOT_ROWS,
    plain: true,
  };

  return Promise.all(BUDDY_ROWS.map(async (row) => ({
    kind: row.kind,
    text: normalizeSlotText(
      await imageToChafaAnsi(createBuddySlotImageData(row.kind), slotOptions),
      slotOptions.width,
      slotOptions.height,
    ),
  })));
}

export async function renderBuddyChafaSlotsFromImageDir(
  imageDir: string = BUDDY_ANIMAL_IMAGE_DIR,
  options: BuddyChafaOptions = {},
): Promise<readonly BuddyChafaSlot[]> {
  const slotOptions = {
    ...options,
    width: options.width ?? SLOT_COLUMNS,
    height: options.height ?? SLOT_ROWS,
    plain: true,
  };
  const resolvedDir = path.resolve(process.cwd(), imageDir);

  return Promise.all(BUDDY_ANIMAL_SOURCES.map(async (source) => {
    const imagePath = path.join(resolvedDir, source.filename);
    const image = await readFile(imagePath);
    const text = await imageToChafaAnsi(
      image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength),
      slotOptions,
    );
    return {
      kind: source.kind,
      text: normalizeSlotText(text, slotOptions.width, slotOptions.height),
    };
  }));
}

export function formatBuddyChafaSlots(slots: readonly BuddyChafaSlot[]): string {
  return `${slots.map((slot) => `${slot.kind}\n${slot.text}`).join('\n\n')}\n`;
}

export function createBuddyDesignImageData(): ImageDataLike {
  const width = 420;
  const height = 260;
  const image = createImage(width, height, PALETTE.bg);

  BUDDY_ROWS.forEach((row, index) => {
    const column = index % 3;
    const gridRow = Math.floor(index / 3);
    const cx = 70 + column * 140;
    const cy = 70 + gridRow * 118;

    drawBuddyAnimal(image, row.kind, cx, cy, row.accent);
    drawLine(image, cx - 24, cy + 37, cx + 24, cy + 37, row.accent, 2);
    drawSpark(image, cx + 42, cy - 34, PALETTE.gold);
  });

  return image;
}

export function createBuddySlotImageData(kind: BuddyAnimalKind): ImageDataLike {
  const width = 128;
  const height = 72;
  const image = createImage(width, height, PALETTE.bg);
  const accent = BUDDY_ROWS.find((row) => row.kind === kind)?.accent ?? PALETTE.cyan;

  drawBuddyAnimal(image, kind, 64, 34, accent);
  drawSpark(image, 103, 14, PALETTE.gold);
  drawLine(image, 39, 66, 89, 66, accent, 2);
  return image;
}

async function imageToChafaAnsi(
  image: ArrayBufferLike | ImageDataLike,
  options: BuddyChafaOptions,
): Promise<string> {
  const chafa = await Chafa();
  const imageToAnsi = promisify(chafa.imageToAnsi);
  const { ansi } = await imageToAnsi(image, {
    format: chafa.ChafaPixelMode.CHAFA_PIXEL_MODE_SYMBOLS.value,
    width: options.width ?? 92,
    height: options.height ?? 36,
    fontRatio: 0.5,
    colors: chafa.ChafaCanvasMode.CHAFA_CANVAS_MODE_TRUECOLOR.value,
    colorExtractor: chafa.ChafaColorExtractor.CHAFA_COLOR_EXTRACTOR_AVERAGE.value,
    colorSpace: chafa.ChafaColorSpace.CHAFA_COLOR_SPACE_RGB.value,
    symbols: options.symbols ?? 'block+border+space-wide-inverted',
    fill: 'space',
    dither: chafa.ChafaDitherMode.CHAFA_DITHER_MODE_NONE.value,
    optimize: 5,
    work: 5,
  });

  return options.plain ? stripAnsi(ansi) : ansi;
}

function drawBuddyAnimal(
  image: ImageDataLike,
  kind: (typeof BUDDY_ROWS)[number]['kind'],
  cx: number,
  cy: number,
  accent: readonly number[],
): void {
  switch (kind) {
    case 'dog':
      drawEllipse(image, cx, cy, 22, 18, PALETTE.blue, 3);
      drawEllipse(image, cx - 20, cy - 6, 9, 14, accent, 3);
      drawEllipse(image, cx + 20, cy - 6, 9, 14, accent, 3);
      drawEyesAndNose(image, cx, cy, accent);
      drawLine(image, cx - 10, cy + 14, cx + 10, cy + 14, accent, 2);
      break;
    case 'owl':
      drawEllipse(image, cx, cy, 23, 21, PALETTE.blue, 3);
      drawLine(image, cx - 17, cy - 19, cx - 7, cy - 30, accent, 3);
      drawLine(image, cx + 17, cy - 19, cx + 7, cy - 30, accent, 3);
      drawEyesAndNose(image, cx, cy, accent);
      drawLine(image, cx - 12, cy + 16, cx + 12, cy + 16, accent, 2);
      break;
    case 'swallow':
      drawLine(image, cx - 32, cy - 2, cx, cy + 5, accent, 4);
      drawLine(image, cx, cy + 5, cx + 32, cy - 2, accent, 4);
      drawLine(image, cx - 28, cy - 2, cx - 6, cy - 20, PALETTE.green, 3);
      drawLine(image, cx + 28, cy - 2, cx + 6, cy - 20, PALETTE.green, 3);
      drawEllipse(image, cx, cy + 8, 9, 7, PALETTE.white, 2);
      drawLine(image, cx + 10, cy + 8, cx + 20, cy + 3, PALETTE.gold, 2);
      break;
    case 'butterfly':
      drawEllipse(image, cx - 15, cy - 6, 17, 20, accent, 3);
      drawEllipse(image, cx + 15, cy - 6, 17, 20, accent, 3);
      drawEllipse(image, cx - 13, cy + 15, 12, 14, PALETTE.cyan, 3);
      drawEllipse(image, cx + 13, cy + 15, 12, 14, PALETTE.cyan, 3);
      drawLine(image, cx, cy - 22, cx, cy + 25, PALETTE.white, 3);
      drawEyesAndNose(image, cx, cy - 3, PALETTE.gold);
      break;
    case 'fox':
      drawLine(image, cx - 24, cy - 16, cx - 8, cy - 30, accent, 4);
      drawLine(image, cx + 24, cy - 16, cx + 8, cy - 30, accent, 4);
      drawEllipse(image, cx, cy, 24, 18, accent, 3);
      drawEyesAndNose(image, cx, cy, PALETTE.gold);
      drawLine(image, cx - 21, cy + 10, cx, cy + 24, PALETTE.white, 3);
      drawLine(image, cx + 21, cy + 10, cx, cy + 24, PALETTE.white, 3);
      break;
    case 'squirrel':
      drawEllipse(image, cx, cy, 18, 17, PALETTE.gold, 3);
      drawEllipse(image, cx + 23, cy - 6, 16, 26, accent, 3);
      drawLine(image, cx + 32, cy - 28, cx + 12, cy - 22, accent, 3);
      drawEyesAndNose(image, cx - 4, cy, PALETTE.white);
      drawEllipse(image, cx - 8, cy + 18, 10, 8, PALETTE.green, 2);
      break;
  }
}

function createImage(width: number, height: number, color: readonly number[]): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    setPixelAtIndex(data, index, color);
  }
  return { width, height, data };
}

function drawEyesAndNose(image: ImageDataLike, cx: number, cy: number, accent: readonly number[]): void {
  fillCircle(image, cx - 8, cy - 3, 3, PALETTE.white);
  fillCircle(image, cx + 8, cy - 3, 3, PALETTE.white);
  fillCircle(image, cx - 8, cy - 3, 1, PALETTE.bg);
  fillCircle(image, cx + 8, cy - 3, 1, PALETTE.bg);
  fillCircle(image, cx, cy + 5, 3, accent);
}

function drawSpark(image: ImageDataLike, cx: number, cy: number, color: readonly number[]): void {
  drawLine(image, cx - 7, cy, cx + 7, cy, color, 2);
  drawLine(image, cx, cy - 7, cx, cy + 7, color, 2);
  drawLine(image, cx - 4, cy - 4, cx + 4, cy + 4, color, 1);
  drawLine(image, cx + 4, cy - 4, cx - 4, cy + 4, color, 1);
}

function drawEllipse(
  image: ImageDataLike,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: readonly number[],
  thickness: number,
): void {
  for (let py = cy - ry - thickness; py <= cy + ry + thickness; py += 1) {
    for (let px = cx - rx - thickness; px <= cx + rx + thickness; px += 1) {
      const value = ((px - cx) * (px - cx)) / (rx * rx) + ((py - cy) * (py - cy)) / (ry * ry);
      if (Math.abs(value - 1) <= thickness / Math.max(rx, ry)) setPixel(image, px, py, color);
    }
  }
}

function fillCircle(image: ImageDataLike, cx: number, cy: number, radius: number, color: readonly number[]): void {
  for (let py = cy - radius; py <= cy + radius; py += 1) {
    for (let px = cx - radius; px <= cx + radius; px += 1) {
      if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= radius * radius) {
        setPixel(image, px, py, color);
      }
    }
  }
}

function drawLine(
  image: ImageDataLike,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: readonly number[],
  thickness: number,
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx - dy;
  let x = x0;
  let y = y0;

  while (true) {
    fillCircle(image, x, y, Math.max(1, Math.floor(thickness / 2)), color);
    if (x === x1 && y === y1) break;
    const doubledError = 2 * error;
    if (doubledError > -dy) {
      error -= dy;
      x += sx;
    }
    if (doubledError < dx) {
      error += dx;
      y += sy;
    }
  }
}

function setPixel(image: ImageDataLike, x: number, y: number, color: readonly number[]): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  setPixelAtIndex(image.data, y * image.width + x, color);
}

function setPixelAtIndex(data: Uint8ClampedArray, index: number, color: readonly number[]): void {
  const offset = index * 4;
  data[offset] = color[0] ?? 0;
  data[offset + 1] = color[1] ?? 0;
  data[offset + 2] = color[2] ?? 0;
  data[offset + 3] = color[3] ?? 255;
}

function readOptions(args: readonly string[]): BuddyChafaOptions {
  return {
    width: readNumberArg(args, WIDTH_ARG),
    height: readNumberArg(args, HEIGHT_ARG),
    plain: args.includes(PLAIN_ARG),
    symbols: readValueArg(args, SYMBOLS_ARG),
  };
}

function readNumberArg(args: readonly string[], prefix: string): number | undefined {
  const value = readValueArg(args, prefix);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : undefined;
}

function readValueArg(args: readonly string[], prefix: string): string | undefined {
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;:]*[A-Za-z]/g, '');
}

function normalizeSlotText(text: string, columns = SLOT_COLUMNS, rows = SLOT_ROWS): string {
  const lines = text.replace(/\s+$/g, '').split('\n').slice(0, rows);
  while (lines.length < rows) lines.push('');
  return lines
    .map((line) => line.slice(0, columns).padEnd(columns, ' '))
    .join('\n');
}

if (import.meta.main) {
  await main();
}
