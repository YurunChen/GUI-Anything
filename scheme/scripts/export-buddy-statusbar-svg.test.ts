import { describe, expect, it } from 'bun:test';
import { BUDDY_CREST_COLORWAYS, resolveInlineBuddyCrest } from '../src/app/ui/flow/BuddyStrip';
import { INTENT_BUDDY_PREVIEW_ITEMS } from './buddy-preview-items';
import { renderBuddyStatusBarSvg, resolveBuddyStatusBarPreviewRows } from './export-buddy-statusbar-svg';

describe('renderBuddyStatusBarSvg', () => {
  it('renders every real intent in a status-bar scale preview', () => {
    const svg = renderBuddyStatusBarSvg();
    const rows = resolveBuddyStatusBarPreviewRows();

    expect(svg).toContain('width="1280"');
    expect(rows.map((row) => row.intentKey)).toEqual(INTENT_BUDDY_PREVIEW_ITEMS.map((item) => item.intentKey));
    for (const item of rows) {
      const code = item.profile.code;
      const crestRows = resolveInlineBuddyCrest(code, 0, item.profile.intentKey).rows;

      expect(svg).toContain(`data-statusbar-buddy="${code}"`);
      expect(svg).toContain(`data-statusbar-intent="${item.intentKey}"`);
      expect(svg).toContain(item.badge);
      expect(svg).toContain(item.title);
      expect(svg).toContain(crestRows.join('/'));
      for (const crestRow of crestRows) {
        expect(svg).toContain(crestRow);
      }
      expect(svg).toContain(BUDDY_CREST_COLORWAYS[code].accentFg);
      expect(svg).toContain(BUDDY_CREST_COLORWAYS[code].focusBg);
    }

    for (const row of resolveInlineBuddyCrest('SHIP', 0, 'test_verify').rows) {
      expect(svg).toContain(row);
    }
    for (const row of resolveInlineBuddyCrest('EXP', 0, 'devops').rows) {
      expect(svg).toContain(row);
    }
  });

  it('renders the status-bar preview as a light crest bed instead of a heavy cell grid', () => {
    const svg = renderBuddyStatusBarSvg();
    const rows = resolveBuddyStatusBarPreviewRows();
    const rectCount = svg.match(/<rect /g)?.length ?? 0;
    const denseGridRectCount = rows.length * 3 * 20;

    expect(rectCount).toBeLessThan(denseGridRectCount / 2);
  });
});
