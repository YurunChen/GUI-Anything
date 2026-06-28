import { describe, expect, it } from 'bun:test';
import { getObserverMessages } from '../i18n/observer-messages';
import { resolveInlineBuddyCrest } from './BuddyStrip';
import { PIXEL_BUDDY_CODES } from './PixelBuddySprite';
import {
  resolveBuddyAnimalSignal,
  resolveBuddyGalleryCrestPresentation,
  resolveBuddyGalleryLayout,
  resolveBuddyGalleryPage,
  resolveBuddyGalleryPresentation,
  resolveBuddySignature,
} from './BuddyGalleryOverlay';

describe('BuddyGalleryOverlay', () => {
  const zh = getObserverMessages('zh-Hans');

  it('uses one column in regular observer panes', () => {
    const layout = resolveBuddyGalleryLayout(96);

    expect(layout.columns).toBe(1);
    expect(layout.cardWidth).toBeLessThanOrEqual(96);
    expect(layout.labelWidth).toBeGreaterThanOrEqual(18);
    expect(layout.pageSize).toBe(2);
    expect(layout.pageCount).toBe(3);
  });

  it('expands to two and three columns only when the pane can support real cards', () => {
    expect(resolveBuddyGalleryLayout(150)).toMatchObject({ columns: 2, pageSize: 4, pageCount: 2 });
    expect(resolveBuddyGalleryLayout(220)).toMatchObject({ columns: 3, pageSize: 6, pageCount: 1 });
  });

  it('pages the six animal buddy cards instead of rendering clipped off-screen rows', () => {
    expect(resolveBuddyGalleryPage(PIXEL_BUDDY_CODES, 2, 0)).toMatchObject({
      page: 0,
      pageCount: 3,
      startIndex: 0,
      endIndex: 2,
      codes: ['ARC', 'VIB'],
    });
    expect(resolveBuddyGalleryPage(PIXEL_BUDDY_CODES, 2, 1).codes).toEqual(['DBG', 'SHIP']);
    expect(resolveBuddyGalleryPage(PIXEL_BUDDY_CODES, 2, 99)).toMatchObject({
      page: 2,
      codes: ['CUR', 'EXP'],
    });
  });

  it('keeps the animated signatures tied to the buddy role', () => {
    expect(resolveBuddySignature('ARC', 0, zh)).toBe('夜枭 · 夜行鸟类');
    expect(resolveBuddySignature('ARC', 8, zh)).toBe('夜枭 · 夜行鸟类');
    expect(resolveBuddySignature('VIB', 4, zh)).toBe('蝶 · 有翅昆虫');
    expect(resolveBuddySignature('EXP', 4, zh)).toBe('路径犬 · 工作犬');
  });

  it('uses role-specific animal signals for the six buddies', () => {
    expect(PIXEL_BUDDY_CODES).toEqual(['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP']);
    expect(resolveBuddyAnimalSignal('ARC', 8, zh)).toMatchObject({ identity: '夜枭', settingLine: '夜间观察点' });
    expect(resolveBuddyAnimalSignal('VIB', 4, zh)).toMatchObject({ identity: '蝶', settingLine: '光翼花园' });
    expect(resolveBuddyAnimalSignal('DBG', 2, zh)).toMatchObject({ identity: '狐', settingLine: '林间路径' });
    expect(resolveBuddyAnimalSignal('SHIP', 4, zh)).toMatchObject({ identity: '海燕', settingLine: '海岸航线' });
    expect(resolveBuddyAnimalSignal('CUR', 8, zh)).toMatchObject({ identity: '松鼠', settingLine: '树洞仓库' });
    expect(resolveBuddyAnimalSignal('EXP', 4, zh)).toMatchObject({ identity: '路径犬', settingLine: '路径入口' });
    expect(resolveBuddyAnimalSignal('ARC', 8, zh)).not.toHaveProperty('status');
  });

  it('builds stable animal-card copy without coding-persona copy', () => {
    expect(resolveBuddyGalleryPresentation('ARC', 8, 40, zh)).toMatchObject({
      title: '夜枭 · 夜行鸟类',
    });
    expect(resolveBuddyGalleryPresentation('ARC', 8, 40, zh).intro).toContain('夜间活动');
    expect(resolveBuddyGalleryPresentation('VIB', 4, 32, zh).title).toBe('蝶 · 有翅昆虫');
    expect(resolveBuddyGalleryPresentation('DBG', 2, 40, zh).intro).toContain('小型犬科动物');
    expect(resolveBuddyGalleryPresentation('EXP', 4, 32, zh).intro).toContain('工作犬');
  });

  it('does not animate the long introduction copy across motion frames', () => {
    const resting = resolveBuddyGalleryPresentation('VIB', 0, 40, zh);
    const active = resolveBuddyGalleryPresentation('VIB', 4, 40, zh);

    expect(active.intro).toBe(resting.intro);
    expect(active).not.toHaveProperty('status');
  });

  it('shows the exact intent-bar crest rows in the gallery for visual inspection', () => {
    const crest = resolveBuddyGalleryCrestPresentation('SHIP', 8, zh);

    expect(crest.label).toBe('徽章 · ');
    expect(crest.rows).toEqual(resolveInlineBuddyCrest('SHIP', 8).rows);
    expect(crest.rows).toHaveLength(3);
  });
});
