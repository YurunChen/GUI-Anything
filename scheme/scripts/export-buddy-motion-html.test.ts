import { describe, expect, it } from 'bun:test';
import {
  BUDDY_CREST_COLORWAYS,
  BUDDY_CREST_PREVIEW_MOTION_FRAMES,
  resolveInlineBuddyCrest,
} from '../src/app/ui/flow/BuddyStrip';
import { INTENT_BUDDY_PREVIEW_ITEMS } from './buddy-preview-items';
import { renderBuddyMotionHtml, resolveBuddyMotionPreviewRows } from './export-buddy-motion-html';

describe('renderBuddyMotionHtml', () => {
  it('renders every real intent and every OpenTUI crest frame into the motion preview', () => {
    const html = renderBuddyMotionHtml();
    const rows = resolveBuddyMotionPreviewRows();

    expect(html).toContain('GUI-Anything Buddy Motion Preview');
    expect(html).toContain('@keyframes buddy-step');
    expect(rows.map((row) => row.intentKey)).toEqual(INTENT_BUDDY_PREVIEW_ITEMS.map((item) => item.intentKey));
    for (const item of rows) {
      const code = item.profile.code;

      expect(html).toContain(`data-motion-buddy="${code}"`);
      expect(html).toContain(`data-motion-intent="${item.intentKey}"`);
      expect(html).toContain(item.badge);
      expect(html).toContain(item.title);
      expect(html).toContain(BUDDY_CREST_COLORWAYS[code].accentFg);
      expect(html).toContain(BUDDY_CREST_COLORWAYS[code].sparkFg);
      expect(html).toContain(BUDDY_CREST_COLORWAYS[code].focusBg);
      for (const frame of BUDDY_CREST_PREVIEW_MOTION_FRAMES) {
        const crestRows = resolveInlineBuddyCrest(code, frame, item.profile.intentKey).rows;
        expect(html).toContain(crestRows.join('/'));
        for (const crestRow of crestRows) {
          expect(html).toContain(crestRow);
        }
      }
    }

    expect(html).toContain(resolveInlineBuddyCrest('SHIP', 0, 'test_verify').rows.join('/'));
    expect(html).toContain(resolveInlineBuddyCrest('EXP', 0, 'devops').rows.join('/'));
  });

  it('keeps a reduced-motion fallback for accessibility review', () => {
    expect(renderBuddyMotionHtml()).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('uses a light motion bed instead of per-glyph background styling', () => {
    const html = renderBuddyMotionHtml();

    expect(html).toContain('--buddy-bed:');
    expect(html).toContain('background: color-mix(in srgb, var(--buddy-bed) 58%, transparent)');
    expect(html).toContain('.tone-eye');
    expect(html).toContain('background: var(--buddy-focus)');
    expect(html).not.toContain('background:var(--surface-2)');
  });
});
