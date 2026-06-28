import { describe, expect, it } from 'bun:test';
import {
  createBuddyDesignImageData,
  createBuddySlotImageData,
  formatBuddyChafaSlots,
  renderGeneratedBuddyChafaAnsi,
  renderGeneratedBuddyChafaSlots,
} from './export-buddy-chafa-ansi';

describe('export-buddy-chafa-ansi', () => {
  it('builds a non-empty generated buddy image for Chafa', () => {
    const image = createBuddyDesignImageData();
    const uniqueColors = new Set<string>();

    for (let index = 0; index < image.data.length; index += 4) {
      uniqueColors.add([
        image.data[index],
        image.data[index + 1],
        image.data[index + 2],
        image.data[index + 3],
      ].join(','));
    }

    expect(image.width).toBe(420);
    expect(image.height).toBe(260);
    expect(uniqueColors.size).toBeGreaterThan(6);
  });

  it('renders the generated buddy image through Chafa ANSI', async () => {
    const ansi = await renderGeneratedBuddyChafaAnsi({ width: 40, height: 12 });

    expect(ansi).toContain('\x1b[');
    expect(ansi.replace(/\x1b\[[0-9;]*m/g, '').trim().length).toBeGreaterThan(20);
  });

  it('can render a plain low-noise design review preview', async () => {
    const text = await renderGeneratedBuddyChafaAnsi({
      width: 40,
      height: 12,
      plain: true,
      symbols: 'border+block+space',
    });

    expect(text).not.toContain('\x1b[');
    expect(text.trim().split('\n').length).toBeGreaterThanOrEqual(8);
    expect(text.trim().length).toBeGreaterThan(20);
  });

  it('builds isolated animal source images for intent-bar slot review', () => {
    const image = createBuddySlotImageData('owl');

    expect(image.width).toBe(128);
    expect(image.height).toBe(72);
    expect(image.data.some((value) => value !== image.data[0])).toBe(true);
  });

  it('renders every generated animal as a fixed 20x3 Chafa slot', async () => {
    const slots = await renderGeneratedBuddyChafaSlots({
      symbols: 'border+block+space',
    });

    expect(slots.map((slot) => slot.kind)).toEqual([
      'dog',
      'owl',
      'swallow',
      'butterfly',
      'fox',
      'squirrel',
    ]);

    for (const slot of slots) {
      expect(slot.text).not.toContain('\x1b[');
      expect(slot.text.split('\n')).toHaveLength(3);
      expect(slot.text.split('\n').every((line) => line.length === 20)).toBe(true);
      expect(slot.text.replace(/\s/g, '').length).toBeGreaterThan(4);
    }
  });

  it('formats Chafa slots as a compact review sheet', async () => {
    const slots = await renderGeneratedBuddyChafaSlots({
      symbols: 'border+block+space',
    });
    const sheet = formatBuddyChafaSlots(slots);

    expect(sheet).toContain('dog\n');
    expect(sheet).toContain('squirrel\n');
    expect(sheet).not.toContain('\x1b[');
  });
});
