import { describe, expect, it } from 'bun:test';
import {
  BUDDY_CREST_COLORWAYS,
  BUDDY_CREST_PREVIEW_MOTION_FRAMES,
  resolveInlineBuddyCrest,
} from '../src/app/ui/flow/BuddyStrip';
import { INTENT_BUDDY_PREVIEW_ITEMS } from './buddy-preview-items';
import { renderBuddyCrestSvg, resolveIntentBuddyDesignItems } from './export-buddy-crest-svg';

describe('renderBuddyCrestSvg', () => {
  it('renders every real intent and every intent-bar motion frame into the design sheet', () => {
    const svg = renderBuddyCrestSvg();
    const items = resolveIntentBuddyDesignItems();

    expect(svg).toContain('GUI-Anything Intent Buddy Crest Sheet · real intent variants');
    expect(svg).toContain('width="1464"');
    expect(svg).toContain('viewBox="0 0 1464');
    expect(items).toHaveLength(INTENT_BUDDY_PREVIEW_ITEMS.length);
    for (const item of items) {
      const code = item.profile.code;

      expect(svg).toContain(`data-buddy="${code}" data-intent="${item.intentKey}"`);
      expect(svg).toContain(item.badge);
      expect(svg).toContain(item.intentKey);
      expect(svg).toContain(BUDDY_CREST_COLORWAYS[item.profile.code].accentFg);
      expect(svg).toContain(BUDDY_CREST_COLORWAYS[item.profile.code].sparkFg);
      expect(svg).toContain(BUDDY_CREST_COLORWAYS[item.profile.code].focusBg);
      for (const frame of BUDDY_CREST_PREVIEW_MOTION_FRAMES) {
        const rows = resolveInlineBuddyCrest(code, frame, item.profile.intentKey).rows;
        expect(svg).toContain(rows.join('/'));
        for (const row of rows) {
          expect(svg).toContain(row);
        }
      }
    }
  });

  it('keeps shared animals visually different when real intents need variants', () => {
    const itemByIntent = new Map(resolveIntentBuddyDesignItems().map((item) => [item.intentKey, item]));
    const explore = itemByIntent.get('explore');
    const devops = itemByIntent.get('devops');
    const implement = itemByIntent.get('implement');
    const verify = itemByIntent.get('test_verify');

    expect(explore?.profile.code).toBe('EXP');
    expect(devops?.profile.code).toBe('EXP');
    expect(implement?.profile.code).toBe('SHIP');
    expect(verify?.profile.code).toBe('SHIP');
    expect(explore?.frames[0]).not.toEqual(devops?.frames[0]);
    expect(implement?.frames[0]).not.toEqual(verify?.frames[0]);
    expect(devops?.frames[0].join('')).toContain('▶');
    expect(verify?.frames[0].join('')).toContain('✓');
  });
});
