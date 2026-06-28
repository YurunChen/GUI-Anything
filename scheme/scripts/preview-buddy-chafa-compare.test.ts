import { describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { BUDDY_TYPE_CODES } from '../src/app/observer/view-model/buddy-profile';
import { BUDDY_ANIMAL_SOURCES } from './buddy-animal-sources';
import { renderBuddyChafaComparison } from './preview-buddy-chafa-compare';

describe('preview-buddy-chafa-compare', () => {
  it('renders every runtime buddy next to a fixed-width Chafa slot', async () => {
    const text = await renderBuddyChafaComparison();

    expect(text).toContain('runtime glyph');
    expect(text).toContain('chafa slot');
    expect(text).toContain('raw chafa slots');
    expect(text).not.toContain('\x1b[');

    for (const code of BUDDY_TYPE_CODES) {
      expect(text).toContain(`${code} · `);
    }

    const comparisonRows = text
      .split('\n')
      .filter((line) => line.includes('│') && !line.includes('runtime glyph'));

    expect(comparisonRows.length).toBe(BUDDY_TYPE_CODES.length * 3);
    for (const row of comparisonRows) {
      const [runtime, chafa] = row.split('│').map((part) => part.trimEnd());

      expect(runtime).toBeTruthy();
      expect(chafa).toBeTruthy();
      expect(chafa.length).toBeGreaterThan(0);
    }
  });

  it('can compare runtime glyphs against image2 source files from a directory', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'buddy-chafa-sources-'));
    const sourceImage = await readFile(path.resolve(import.meta.dir, '../../assets/logo.png'));

    try {
      await Promise.all(
        BUDDY_ANIMAL_SOURCES.map((source) =>
          writeFile(path.join(tmpDir, source.filename), sourceImage),
        ),
      );

      const text = await renderBuddyChafaComparison({ imageDir: tmpDir });

      expect(text).toContain(`image2 source: ${tmpDir}`);
      expect(text).toContain('ARC · owl');
      expect(text).toContain('EXP · dog');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
