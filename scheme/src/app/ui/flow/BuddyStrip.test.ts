import { describe, expect, it } from 'bun:test';
import { TextAttributes } from '@opentui/core';
import { SESSION_INTENT_KEYS } from '../../../constants/session-intent-keys';
import { lineDisplayWidth } from '../../../utils/flow-text';
import { BUDDY_TYPE_CODES, resolveBuddyProfileFromIntent } from '../../observer/view-model/buddy-profile';
import {
  BUDDY_BRAILLE_CONTOUR_CHARS,
  BUDDY_CREST_COLORWAYS,
  BUDDY_CREST_DESIGN,
  BUDDY_CREST_MOTION_SEQUENCE,
  BUDDY_CREST_PREVIEW_MOTION_FRAMES,
  BUDDY_GLYPH_TONE_CHARACTERS,
  INTENT_BUDDY_COLUMNS,
  INTENT_BUDDY_ROWS,
  INLINE_BUDDY_CREST_ART,
  INLINE_BUDDY_CREST_INTENT_ART,
  resolveBuddyCrestMotionPhase,
  resolveBuddyCrestPalette,
  resolveBuddyCrestSurfaceBackgroundColor,
  resolveBuddyCrestPreviewRows,
  resolveBuddyFrameBackgroundColor,
  resolveBuddyGlyphAttributes,
  resolveBuddyGlyphBackgroundColor,
  resolveBuddyGlyphStyle,
  resolveBuddyGlyphTone,
  resolveBuddyStripBackgroundColor,
  resolveBuddyStripPresentation,
  resolveInlineBuddyCrest,
  resolveInlineBuddyCrestFiller,
  resolveLineBuddyAvatar,
} from './BuddyStrip';

describe('BuddyStrip', () => {
  const intentCueGlyphs: Record<string, readonly string[]> = {
    explore: ['⌕'],
    project_design: ['⌂'],
    implement: ['↗', '▸'],
    refactor: ['⋈', '≈'],
    debug: ['╳', '◆'],
    test_verify: ['✓'],
    devops: ['▶', '▸'],
    research: ['∽', '□', '⌾'],
  };
  const profile = {
    code: 'VIB' as const,
    name: 'Luma 蝶',
    devStyle: 'The Vibe Refiner',
    line: '蝶，一种有翅昆虫，动作轻、视觉特征明显。',
    intentKey: 'project_design',
  };

  it('uses background tone as the buddy emphasis instead of a left border', () => {
    const fill = { grouped: '#111111', elevated: '#222222' };

    expect(resolveBuddyStripBackgroundColor(0, fill)).toBe('#111111');
    expect(resolveBuddyStripBackgroundColor(1, fill)).toBe('#111111');
    expect(resolveBuddyStripBackgroundColor(2, fill)).toBe('#222222');
  });

  it('uses a fixed-width inline color bed so the intent buddy reads as a stable crest', () => {
    const palette = {
      baseBg: '#101010',
      alternateBg: '#222222',
      frameBg: '#333333',
      focusBg: '#000000',
      outlineFg: '#444444',
      accentFg: '#555555',
      frameFg: '#666666',
      eyeFg: '#777777',
      sparkFg: '#888888',
    };

    expect(resolveBuddyCrestSurfaceBackgroundColor(0, palette)).toBe('#333333');
    expect(resolveBuddyCrestSurfaceBackgroundColor(2, palette)).toBe('#333333');
    expect(resolveBuddyCrestSurfaceBackgroundColor(8, palette)).toBe('#222222');
    expect(resolveBuddyCrestSurfaceBackgroundColor(9, palette)).toBe('#222222');
    expect(resolveBuddyFrameBackgroundColor(0, palette)).toBe('#333333');
    expect(resolveBuddyFrameBackgroundColor(8, palette)).toBe('#222222');
  });

  it('uses a dedicated line-crest colorway instead of inheriting the pixel sprite palette', () => {
    const theme = {
      modes: {
        statusBar: {
          backgroundColor: '#05070b',
        },
      },
    } as never;

    expect(Object.keys(BUDDY_CREST_COLORWAYS)).toEqual([...BUDDY_TYPE_CODES]);
    for (const code of BUDDY_TYPE_CODES) {
      const palette = resolveBuddyCrestPalette(code, theme);

      expect(palette).toEqual({
        baseBg: '#05070b',
        ...BUDDY_CREST_COLORWAYS[code],
      });
      expect(palette.accentFg).not.toBe(palette.outlineFg);
      expect(palette.sparkFg).not.toBe(palette.accentFg);
      expect(palette.focusBg).not.toBe(palette.baseBg);
      expect(palette.focusBg).not.toBe(palette.frameBg);
    }
  });

  it('uses a dedicated line-crest motion clock instead of depending on pixel sprite animation', () => {
    expect(BUDDY_CREST_MOTION_SEQUENCE).toEqual([
      0, 0, 1, 0, 2, 4, 2, 0,
      3, 5, 3, 0, 1, 0, 2, 0,
    ]);
    expect(resolveBuddyCrestMotionPhase(0)).toBe(0);
    expect(resolveBuddyCrestMotionPhase(2)).toBe(1);
    expect(resolveBuddyCrestMotionPhase(4)).toBe(2);
    expect(resolveBuddyCrestMotionPhase(8)).toBe(3);
    expect(resolveBuddyCrestMotionPhase(9)).toBe(5);
    expect(resolveBuddyCrestMotionPhase(16)).toBe(0);
    expect(resolveBuddyCrestMotionPhase(-1)).toBe(0);
  });

  it('keeps only the animal marker in the timeline strip', () => {
    const presentation = resolveBuddyStripPresentation(profile, 42);

    expect(presentation.showAvatar).toBe(true);
    expect(presentation.avatarColumns).toBe(12);
    expect(presentation.avatarRows).toEqual([
      ' ╲◜ ╽ ◝╱    ',
      '  ╲◉╽◉╱     ',
      '  ╲╲╽╱╱     ',
      '  ╱╱╽╲╲     ',
      ' ╱◝ ╽ ◜╲    ',
    ]);
    expect(Object.keys(presentation)).toEqual([
      'showAvatar',
      'avatarColumns',
      'avatarRows',
      'entryIndent',
    ]);
  });

  it('hides the animal marker when the pane is too narrow', () => {
    const presentation = resolveBuddyStripPresentation(profile, 8);

    expect(presentation.showAvatar).toBe(false);
    expect(presentation.avatarColumns).toBe(12);
    expect(presentation.avatarRows).toHaveLength(5);
  });

  it('uses a compact three-row crest in the intent bar without turning into a large sprite', () => {
    const presentation = resolveBuddyStripPresentation(profile, 42, 0, 'inline');

    expect(presentation.showAvatar).toBe(true);
    expect(presentation.avatarColumns).toBe(INTENT_BUDDY_COLUMNS);
    expect(presentation.avatarRows).toHaveLength(INTENT_BUDDY_ROWS);
    expect(presentation.avatarRows.every((row) => lineDisplayWidth(row) === INTENT_BUDDY_COLUMNS)).toBe(true);
    expect(presentation.avatarRows).toEqual([
      '     ✦⡶╭╲╽╱╮⢶⋈✧     ',
      '     ·⡶◉╲╽╱◉⢶≈⋈     ',
      '     ✧╰╱╲╽╱╲╯≈·     ',
    ]);
  });

  it('uses intent-specific crest variants when real task intents share an animal', () => {
    const buildRows = resolveInlineBuddyCrest('SHIP', 0, 'implement').rows;
    const verifyRows = resolveInlineBuddyCrest('SHIP', 0, 'test_verify').rows;
    const exploreRows = resolveInlineBuddyCrest('EXP', 0, 'explore').rows;
    const devopsRows = resolveInlineBuddyCrest('EXP', 0, 'devops').rows;

    expect(verifyRows).not.toEqual(buildRows);
    expect(devopsRows).not.toEqual(exploreRows);
    expect(verifyRows.join('')).toContain('✓');
    expect(devopsRows.join('')).toContain('▶');
    expect(devopsRows.join('')).toContain('▸');

    for (const rows of [buildRows, verifyRows, exploreRows, devopsRows]) {
      expect(rows).toHaveLength(INTENT_BUDDY_ROWS);
      expect(rows.every((row) => lineDisplayWidth(row) === INTENT_BUDDY_COLUMNS)).toBe(true);
    }
  });

  it('gives every visible task intent an explicit curated crest entry', () => {
    const visibleIntentKeys = SESSION_INTENT_KEYS
      .map((item) => item.key)
      .filter((key) => key !== 'general');

    for (const intentKey of visibleIntentKeys) {
      const profile = resolveBuddyProfileFromIntent(intentKey, 'en');
      const artwork = INLINE_BUDDY_CREST_INTENT_ART[intentKey];

      expect(profile).toBeTruthy();
      expect(artwork).toBeTruthy();
      expect(artwork?.code).toBe(profile?.code);
      expect(artwork?.stable).toHaveLength(INTENT_BUDDY_ROWS);
      expect(artwork?.blink).toHaveLength(INTENT_BUDDY_ROWS);
      expect(artwork?.lift).toHaveLength(INTENT_BUDDY_ROWS);
      expect(artwork?.pulse).toHaveLength(INTENT_BUDDY_ROWS);
    }
  });

  it('keeps every visible intent crest distinct from the base animal fallback', () => {
    const visibleIntentKeys = SESSION_INTENT_KEYS
      .map((item) => item.key)
      .filter((key) => key !== 'general');
    const stableIntentFrames = new Set<string>();

    for (const intentKey of visibleIntentKeys) {
      const profile = resolveBuddyProfileFromIntent(intentKey, 'en');
      expect(profile).toBeTruthy();
      if (!profile) continue;

      const intentFrame = resolveInlineBuddyCrest(profile.code, 0, profile.intentKey).rows.join('\n');
      const baseFrame = resolveInlineBuddyCrest(profile.code, 0).rows.join('\n');

      expect(intentFrame).not.toBe(baseFrame);
      expect(stableIntentFrames.has(intentFrame)).toBe(false);
      stableIntentFrames.add(intentFrame);
    }
  });

  it('keeps every visible intent crest visually authored instead of generic symbol noise', () => {
    const visibleIntentKeys = SESSION_INTENT_KEYS
      .map((item) => item.key)
      .filter((key) => key !== 'general');

    for (const intentKey of visibleIntentKeys) {
      const profile = resolveBuddyProfileFromIntent(intentKey, 'en');
      expect(profile).toBeTruthy();
      if (!profile) continue;

      const rows = resolveInlineBuddyCrest(profile.code, 0, profile.intentKey).rows;
      const compactRows = rows.map((row) => row.trim());
      const compactText = compactRows.join('');
      const nonSpaceGlyphCount = compactText.replace(/\s/g, '').length;
      const contourCount = Array.from(compactRows[0] ?? '')
        .filter((char) => BUDDY_BRAILLE_CONTOUR_CHARS.includes(char))
        .length;
      const eyeCount = Array.from(compactRows[1] ?? '').filter((char) => resolveBuddyGlyphTone(char) === 'eye').length;
      const cueHits = intentCueGlyphs[intentKey]?.reduce(
        (count, cue) => count + Array.from(compactText).filter((char) => char === cue).length,
        0,
      ) ?? 0;
      const rowToneCounts = compactRows.map((row) => new Set(Array.from(row).map(resolveBuddyGlyphTone)).size);

      expect(nonSpaceGlyphCount).toBeGreaterThanOrEqual(30);
      expect(nonSpaceGlyphCount).toBeLessThanOrEqual(36);
      expect(contourCount).toBeGreaterThanOrEqual(2);
      expect(eyeCount).toBeGreaterThanOrEqual(2);
      expect(cueHits).toBeGreaterThanOrEqual(2);
      expect(rowToneCounts.every((count) => count >= 2)).toBe(true);
      expect(compactText).not.toMatch(/(.)\1{3,}/);
    }
  });

  it('drives the inline crest variant from the profile intent key', () => {
    const verifyProfile = {
      ...profile,
      code: 'SHIP' as const,
      intentKey: 'test_verify',
    };
    const buildProfile = {
      ...profile,
      code: 'SHIP' as const,
      intentKey: 'implement',
    };

    expect(resolveBuddyStripPresentation(verifyProfile, 42, 0, 'inline').avatarRows)
      .toEqual(resolveInlineBuddyCrest('SHIP', 0, 'test_verify').rows);
    expect(resolveBuddyStripPresentation(buildProfile, 42, 0, 'inline').avatarRows)
      .toEqual(resolveInlineBuddyCrest('SHIP', 0, 'implement').rows);
  });

  it('does not add animal name, intent text, or buddy status metadata', () => {
    const presentation = resolveBuddyStripPresentation(profile, 84);

    expect(presentation.showAvatar).toBe(true);
    expect('title' in presentation).toBe(false);
    expect('line' in presentation).toBe(false);
    expect('textWidth' in presentation).toBe(false);
    expect('titlePrefix' in presentation).toBe(false);
  });

  it('settles the entry treatment after the first motion frames', () => {
    expect(resolveBuddyStripPresentation(profile, 84, 0)).toMatchObject({ entryIndent: 2 });
    expect(resolveBuddyStripPresentation(profile, 84, 1)).toMatchObject({ entryIndent: 1 });
    expect(resolveBuddyStripPresentation(profile, 84, 2)).toMatchObject({ entryIndent: 0 });
  });

  it('uses crisp line avatars instead of sampled pixels in the timeline', () => {
    const codes = ['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const;

    for (const code of codes) {
      const avatar = resolveLineBuddyAvatar(code, 0);

      expect(avatar.width).toBe(12);
      expect(avatar.rows).toHaveLength(5);
      expect(avatar.rows.every((row) => row.length === 12)).toBe(true);
      expect(avatar.rows.join('')).not.toContain('█');
    }
  });

  it('keeps each intent animal visually distinct at badge size', () => {
    const codes = ['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const;
    const silhouettes = new Set(codes.map((code) => resolveLineBuddyAvatar(code, 0).rows.join('\n')));

    expect(silhouettes.size).toBe(codes.length);
    for (const code of codes) {
      const ink = resolveLineBuddyAvatar(code, 0).rows.join('').replace(/\s/g, '');
      expect(ink.length).toBeGreaterThanOrEqual(22);
    }
  });

  it('keeps each intent-bar crest compact, expressive, and distinct', () => {
    const codes = ['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const;
    const crests = new Set(codes.map((code) => resolveInlineBuddyCrest(code, 0).rows[0]));

    expect(crests.size).toBe(codes.length);
    for (const code of codes) {
      const crest = resolveInlineBuddyCrest(code, 0);

      expect(crest.width).toBe(INTENT_BUDDY_COLUMNS);
      expect(crest.rows).toHaveLength(INTENT_BUDDY_ROWS);
      expect(crest.rows.every((row) => lineDisplayWidth(row) === INTENT_BUDDY_COLUMNS)).toBe(true);
      expect(crest.rows.join('').replace(/\s/g, '').length).toBeGreaterThanOrEqual(20);
      expect(crest.rows.join('')).not.toContain('█');
    }
  });

  it('uses braille micro-contours in every stable intent crest for higher detail without extra height', () => {
    for (const code of BUDDY_TYPE_CODES) {
      const row = resolveInlineBuddyCrest(code, 0).rows[0];
      const contours = Array.from(row).filter((char) => BUDDY_BRAILLE_CONTOUR_CHARS.includes(char));

      expect(contours.length).toBeGreaterThanOrEqual(2);
      expect(lineDisplayWidth(row)).toBe(INTENT_BUDDY_COLUMNS);
    }
  });

  it('keeps the curated intent-bar crest artwork stable', () => {
    expect(Object.keys(INLINE_BUDDY_CREST_ART)).toEqual([...BUDDY_TYPE_CODES]);
    expect(Object.fromEntries(
      (['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const)
        .map((code) => [code, resolveInlineBuddyCrest(code, 0).rows]),
    )).toEqual({
      ARC: ['     ⟡⡴╭∧⌂∧╮⢦⌂✦     ', '     ·⡴◉╲⌄╱◉⢦╱⌂     ', '     ✦⢦╰═⌂═╯⡴⟡·     '],
      VIB: ['     ✦⡶╭╲╽╱╮⢶⋈✧     ', '     ·⡶◉╲╽╱◉⢶≈⋈     ', '     ✧╰╱╲╽╱╲╯≈·     '],
      DBG: ['     ✦⡶△╲╳╱△⢶╳◆     ', '     ·⡶◉╲▿╱◉⢶◆╳     ', '     ✦╰╳╲◇╱╳╯⟡·     '],
      SHIP: ['     ↗⡴╲∧▸∧╱⢦✦↗     ', '     ·⡴╲◉▸◉╱⢦◇▸     ', '     ✦╰╲◈▸◈╱╯↗·     '],
      CUR: ['     ∽⡴◜╭⌾╮◝⢦∽✦     ', '     ✦⡴◉╮ᴥ╭◉⢦~□     ', '     ·╰╮╰□╯╭╯∽⟡     '],
      EXP: ['     ◇⡴╭∪⌕∪╮⢦⌕✦     ', '     ·⡴◉╮ᴥ╭◉⢦◇⌕     ', '     ✦╰╮╰⌕╯╭╯◆·     '],
    });
  });

  it('keeps every intent-bar crest as an unframed fixed-column animal slot', () => {
    for (const code of BUDDY_TYPE_CODES) {
      const row = resolveInlineBuddyCrest(code, 0).rows[0];

      expect(row.trimStart().startsWith('▏')).toBe(false);
      expect(row.trimEnd().endsWith('▕')).toBe(false);
      expect(lineDisplayWidth(row)).toBe(INTENT_BUDDY_COLUMNS);
      expect(row.match(/^ */)?.[0].length ?? 0).toBeGreaterThan(0);
      expect(row.match(/ *$/)?.[0].length ?? 0).toBeGreaterThan(0);
    }
  });

  it('lets pulse frames breathe inside the fixed slot without noisy filler', () => {
    expect(resolveInlineBuddyCrestFiller(0)).toBe(' ');
    expect(resolveInlineBuddyCrestFiller(8)).toBe(' ');
    expect(resolveInlineBuddyCrestFiller(9)).toBe(' ');

    for (const code of BUDDY_TYPE_CODES) {
      const stable = resolveInlineBuddyCrest(code, 0).rows[0];
      const blink = resolveInlineBuddyCrest(code, 2).rows[0];
      const pulse = resolveInlineBuddyCrest(code, 8).rows[0];

      expect(stable).not.toContain('▏');
      expect(blink).not.toContain('▕');
      expect(pulse).not.toContain('▌');
      expect(pulse).not.toContain('▐');
      expect(pulse).toContain('⟡');
      expect(pulse).not.toContain('█');
      expect(lineDisplayWidth(stable)).toBe(INTENT_BUDDY_COLUMNS);
      expect(lineDisplayWidth(blink)).toBe(INTENT_BUDDY_COLUMNS);
      expect(lineDisplayWidth(pulse)).toBe(INTENT_BUDDY_COLUMNS);
    }
  });

  it('keeps animal landmarks readable in the compact intent crests', () => {
    for (const code of BUDDY_TYPE_CODES) {
      const row = resolveInlineBuddyCrest(code, 0).rows.join('\n');

      expect(row).toMatch(BUDDY_CREST_DESIGN[code].landmark);
    }
  });

  it('keeps every visual design contract tied to exactly one intent animal', () => {
    expect(Object.keys(BUDDY_CREST_DESIGN)).toEqual([...BUDDY_TYPE_CODES]);
    expect(new Set(Object.values(BUDDY_CREST_DESIGN).map((design) => design.animal)).size)
      .toBe(BUDDY_TYPE_CODES.length);
    expect(new Set(Object.values(BUDDY_CREST_DESIGN).map((design) => design.intentSignal)).size)
      .toBe(BUDDY_TYPE_CODES.length);
  });

  it('keeps each motion frame inside its animal design contract', () => {
    for (const code of BUDDY_TYPE_CODES) {
      const design = BUDDY_CREST_DESIGN[code];
      const frames = [0, 2, 4, 8].map((motionFrame) => resolveInlineBuddyCrest(code, motionFrame).rows.join('\n'));

      for (const frame of frames) {
        expect(frame).toMatch(design.landmark);
      }
    }
  });

  it('keeps every motion frame tied to animal silhouette, expression, and intent cue anchors', () => {
    for (const code of BUDDY_TYPE_CODES) {
      const design = BUDDY_CREST_DESIGN[code];
      const frames = [0, 2, 4, 8].map((motionFrame) => resolveInlineBuddyCrest(code, motionFrame).rows.join('\n'));

      for (const frame of frames) {
        expect(frame).toMatch(design.anchors.silhouette);
        expect(frame).toMatch(design.anchors.expression);
        expect(frame).toMatch(design.anchors.intentCue);
      }
    }
  });

  it('centers each intent-bar crest inside the fixed column slot', () => {
    const codes = ['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const;

    for (const code of codes) {
      const row = resolveInlineBuddyCrest(code, 0).rows[0];
      const leftPadding = row.match(/^ */)?.[0].length ?? 0;
      const rightPadding = row.match(/ *$/)?.[0].length ?? 0;

      expect(Math.abs(leftPadding - rightPadding)).toBeLessThanOrEqual(1);
      expect(lineDisplayWidth(row)).toBe(INTENT_BUDDY_COLUMNS);
    }
  });

  it('keeps every curated artwork frame compact and visually layered', () => {
    for (const artwork of Object.values(INLINE_BUDDY_CREST_ART)) {
      const frames = [artwork.stable, artwork.blink, artwork.lift, artwork.pulse]
        .filter((frame): frame is readonly string[] => Array.isArray(frame));

      for (const frame of frames) {
        const glyphTones = new Set(Array.from(frame.join('')).map(resolveBuddyGlyphTone));

        for (const row of frame) {
          expect(lineDisplayWidth(row)).toBeGreaterThanOrEqual(10);
          expect(lineDisplayWidth(row)).toBeLessThanOrEqual(INTENT_BUDDY_COLUMNS - 2);
          expect(row).not.toContain('█');
          expect(row).not.toContain('@');
        }
        expect(glyphTones.size).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('uses only single-cell glyphs in every intent-bar crest frame', () => {
    for (const artwork of Object.values(INLINE_BUDDY_CREST_ART)) {
      const rows = [artwork.stable, artwork.blink, artwork.lift, artwork.pulse]
        .filter((frame): frame is readonly string[] => Array.isArray(frame))
        .flatMap((frame) => frame);

      for (const row of rows) {
        for (const char of Array.from(row)) {
          expect(lineDisplayWidth(char)).toBe(1);
        }
      }
    }
  });

  it('uses enough ink for refined animal silhouettes without filling the whole status bar', () => {
    for (const artwork of Object.values(INLINE_BUDDY_CREST_ART)) {
      const rows = [artwork.stable, artwork.blink, artwork.lift, artwork.pulse]
        .filter((frame): frame is readonly string[] => Array.isArray(frame))
        .flatMap((frame) => frame);

      for (const row of rows) {
        expect(lineDisplayWidth(row)).toBeGreaterThanOrEqual(10);
        expect(lineDisplayWidth(row)).toBeLessThanOrEqual(INTENT_BUDDY_COLUMNS - 2);
      }
    }
  });

  it('keeps raw animation frames the same width so the crest does not jitter', () => {
    for (const artwork of Object.values(INLINE_BUDDY_CREST_ART)) {
      const frames = [artwork.stable, artwork.blink, artwork.lift, artwork.pulse]
        .filter((frame): frame is readonly string[] => Array.isArray(frame));
      const rowCounts = new Set(frames.map((frame) => frame.length));
      const widthsByRow = Array.from({ length: INTENT_BUDDY_ROWS }, (_, rowIndex) =>
        new Set(frames.map((frame) => lineDisplayWidth(frame[rowIndex] ?? ''))),
      );

      expect(rowCounts).toEqual(new Set([INTENT_BUDDY_ROWS]));
      for (const widths of widthsByRow) {
        expect(widths.size).toBe(1);
      }
    }
  });

  it('gives every intent animal stable, blink, lift, and pulse crest frames', () => {
    for (const code of BUDDY_TYPE_CODES) {
      const artwork = INLINE_BUDDY_CREST_ART[code];

      expect(artwork.stable).toBeTruthy();
      expect(artwork.blink).toBeTruthy();
      expect(artwork.lift).toBeTruthy();
      expect(artwork.pulse).toBeTruthy();
      expect(new Set([artwork.stable, artwork.blink, artwork.lift, artwork.pulse].map((frame) => frame?.join('\n'))).size)
        .toBe(4);
    }
  });

  it('keeps glyph tone specifications explicit and exhaustive for the artwork set', () => {
    const toneSamples = [
      ['frame', BUDDY_GLYPH_TONE_CHARACTERS.frame],
      ['eye', BUDDY_GLYPH_TONE_CHARACTERS.eye],
      ['spark', BUDDY_GLYPH_TONE_CHARACTERS.spark],
      ['accent', BUDDY_GLYPH_TONE_CHARACTERS.accent],
    ] as const;

    for (const [tone, characters] of toneSamples) {
      for (const char of characters) {
        expect(resolveBuddyGlyphTone(char)).toBe(tone);
      }
    }

    const artworkGlyphs = new Set(
      Object.values(INLINE_BUDDY_CREST_ART)
        .flatMap((artwork) => [artwork.stable, artwork.blink, artwork.lift, artwork.pulse])
        .filter((frame): frame is readonly string[] => Array.isArray(frame))
        .flatMap((frame) => frame)
        .flatMap((row) => Array.from(row.replace(/\s/g, ''))),
    );

    for (const glyph of artworkGlyphs) {
      expect(resolveBuddyGlyphTone(glyph)).toMatch(/outline|accent|spark|eye|frame/);
    }
  });

  it('gives each intent-bar crest layered glyph tones for a polished compact mark', () => {
    const codes = ['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const;

    for (const code of codes) {
      const glyphTones = new Set(
        Array.from(resolveInlineBuddyCrest(code, 0).rows.join('').trim())
          .map(resolveBuddyGlyphTone),
      );

      expect(glyphTones.size).toBeGreaterThanOrEqual(3);
      expect(glyphTones.has('frame')).toBe(false);
      expect(glyphTones.has('eye')).toBe(true);
      expect(glyphTones.has('accent')).toBe(true);
      expect(glyphTones.has('spark')).toBe(true);
    }
  });

  it('adds terminal text weight only to the tiny focal glyphs', () => {
    expect(resolveBuddyGlyphAttributes('eye')).toBe(TextAttributes.BOLD);
    expect(resolveBuddyGlyphAttributes('spark')).toBe(TextAttributes.BOLD);
    expect(resolveBuddyGlyphAttributes('frame')).toBe(TextAttributes.NONE);
    expect(resolveBuddyGlyphAttributes('accent')).toBe(TextAttributes.NONE);
    expect(resolveBuddyGlyphAttributes('outline')).toBe(TextAttributes.NONE);
  });

  it('uses focus and animal colorway backgrounds for a layered unframed inline crest', () => {
    const palette = {
      baseBg: '#101010',
      alternateBg: '#222222',
      frameBg: '#333333',
      focusBg: '#000000',
      outlineFg: '#444444',
      accentFg: '#555555',
      frameFg: '#666666',
      eyeFg: '#777777',
      sparkFg: '#888888',
    };
    const inlineBase = resolveBuddyCrestSurfaceBackgroundColor(0, palette);

    expect(resolveBuddyGlyphBackgroundColor('frame', palette, true, inlineBase, 0)).toBe('#333333');
    expect(resolveBuddyGlyphBackgroundColor('frame', palette, true, inlineBase, 8)).toBe('#222222');
    expect(resolveBuddyGlyphBackgroundColor('eye', palette, true, inlineBase)).toBe('#000000');
    expect(resolveBuddyGlyphBackgroundColor('spark', palette, true, inlineBase)).toBe('#000000');
    expect(resolveBuddyGlyphBackgroundColor('accent', palette, true, inlineBase)).toBe(inlineBase);
    expect(resolveBuddyGlyphBackgroundColor('outline', palette, true, inlineBase)).toBe(inlineBase);
    expect(resolveBuddyGlyphBackgroundColor('eye', palette, false)).toBeUndefined();
    expect(resolveBuddyGlyphBackgroundColor('spark', palette, false)).toBeUndefined();
  });

  it('paints inline crest cells with open space and tiny focal glints', () => {
    const palette = {
      baseBg: '#101010',
      alternateBg: '#222222',
      frameBg: '#333333',
      focusBg: '#000000',
      outlineFg: '#444444',
      accentFg: '#555555',
      frameFg: '#666666',
      eyeFg: '#777777',
      sparkFg: '#888888',
    };
    const inlineBase = resolveBuddyCrestSurfaceBackgroundColor(0, palette);
    const row = resolveInlineBuddyCrest('VIB', 0).rows[0];

    expect(lineDisplayWidth(row)).toBe(INTENT_BUDDY_COLUMNS);
    for (const char of Array.from(row)) {
      const tone = resolveBuddyGlyphTone(char);
      const style = resolveBuddyGlyphStyle(tone, palette, true, inlineBase, 0);

      expect(tone).not.toBe('frame');
      if (tone === 'eye' || tone === 'spark') {
        expect(style.bg).toBe('#000000');
      } else {
        expect(style.bg).toBe(inlineBase);
      }
    }
  });

  it('resolves the complete glyph style from one visual contract', () => {
    const palette = {
      baseBg: '#101010',
      alternateBg: '#222222',
      frameBg: '#333333',
      focusBg: '#000000',
      outlineFg: '#444444',
      accentFg: '#555555',
      frameFg: '#666666',
      eyeFg: '#777777',
      sparkFg: '#888888',
    };

    const inlineBase = resolveBuddyCrestSurfaceBackgroundColor(0, palette);

    expect(resolveBuddyGlyphStyle('eye', palette, true, inlineBase)).toEqual({
      fg: '#777777',
      bg: '#000000',
      attributes: TextAttributes.BOLD,
    });
    expect(resolveBuddyGlyphStyle('spark', palette, true, inlineBase)).toEqual({
      fg: '#888888',
      bg: '#000000',
      attributes: TextAttributes.BOLD,
    });
    expect(resolveBuddyGlyphStyle('frame', palette, true, '#121826', 0)).toEqual({
      fg: '#666666',
      bg: '#333333',
      attributes: TextAttributes.NONE,
    });
    expect(resolveBuddyGlyphStyle('frame', palette, true, '#121826', 8)).toEqual({
      fg: '#666666',
      bg: '#222222',
      attributes: TextAttributes.NONE,
    });
    expect(resolveBuddyGlyphStyle('accent', palette, true, inlineBase)).toEqual({
      fg: '#555555',
      bg: inlineBase,
      attributes: TextAttributes.NONE,
    });
    expect(resolveBuddyGlyphStyle('outline', palette, false)).toEqual({
      fg: '#444444',
      bg: undefined,
      attributes: TextAttributes.NONE,
    });
  });

  it('animates every intent-bar crest without changing its compact footprint', () => {
    const codes = ['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const;

    for (const code of codes) {
      const frames = [0, 2, 4, 8].map((motionFrame) => resolveInlineBuddyCrest(code, motionFrame).rows);

      expect(new Set(frames.map((frame) => frame.join('\n'))).size).toBe(4);
      for (const frame of frames) {
        expect(frame).toHaveLength(INTENT_BUDDY_ROWS);
        expect(frame.every((row) => lineDisplayWidth(row) === INTENT_BUDDY_COLUMNS)).toBe(true);
      }
    }
  });

  it('provides a compact visual preview contract for all crest frames', () => {
    const rows = resolveBuddyCrestPreviewRows();

    expect(BUDDY_CREST_PREVIEW_MOTION_FRAMES).toEqual([0, 2, 4, 8]);
    expect(rows).toHaveLength(BUDDY_TYPE_CODES.length);
    for (const code of BUDDY_TYPE_CODES) {
      const row = rows.find((candidate) => candidate.startsWith(`${code} `));
      const design = BUDDY_CREST_DESIGN[code];
      const frames = BUDDY_CREST_PREVIEW_MOTION_FRAMES
        .map((motionFrame) => resolveInlineBuddyCrest(code, motionFrame).rows.join('/'));

      expect(row).toBeTruthy();
      expect(row).toContain(design.animal);
      expect(row).toContain(design.intentSignal);
      for (const frame of frames) {
        expect(row).toContain(frame);
      }
      expect(row).not.toContain('\n');
    }
  });
});
