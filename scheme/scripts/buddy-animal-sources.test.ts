import { describe, expect, it } from 'bun:test';

import { BUDDY_TYPE_CODES } from '../src/app/observer/view-model/buddy-profile';
import {
  BUDDY_ANIMAL_IMAGE_DIR,
  BUDDY_ANIMAL_SOURCES,
  formatBuddyAnimalImagePrompt,
  resolveBuddyAnimalSource,
} from './buddy-animal-sources';

describe('buddy-animal-sources', () => {
  it('covers every Buddy code with one image2 source prompt', () => {
    expect(BUDDY_ANIMAL_IMAGE_DIR).toBe('../assets/buddy/source');
    expect(BUDDY_ANIMAL_SOURCES.map((source) => source.code)).toEqual(BUDDY_TYPE_CODES);
    expect(new Set(BUDDY_ANIMAL_SOURCES.map((source) => source.kind)).size).toBe(BUDDY_ANIMAL_SOURCES.length);
    expect(new Set(BUDDY_ANIMAL_SOURCES.map((source) => source.filename)).size).toBe(BUDDY_ANIMAL_SOURCES.length);
  });

  it('keeps prompts suitable for tiny Chafa terminal conversion', () => {
    for (const source of BUDDY_ANIMAL_SOURCES) {
      const prompt = formatBuddyAnimalImagePrompt(source);

      expect(prompt).toContain(source.promptSubject);
      expect(prompt).toContain(source.accent);
      expect(prompt).toContain('no text');
      expect(prompt).toContain('20 columns by 3 rows');
    }
  });

  it('resolves image sources by animal kind or Buddy code', () => {
    expect(resolveBuddyAnimalSource('owl')?.code).toBe('ARC');
    expect(resolveBuddyAnimalSource('DBG')?.kind).toBe('fox');
    expect(resolveBuddyAnimalSource('missing')).toBeUndefined();
  });
});
