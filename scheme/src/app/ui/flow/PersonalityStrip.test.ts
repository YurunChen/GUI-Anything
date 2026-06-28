import { describe, expect, it } from 'bun:test';
import {
  resolvePersonalityBorderColor,
  resolvePersonalityPulseGlyph,
  resolvePersonalityRarityChrome,
} from './PersonalityStrip';

describe('PersonalityStrip motion', () => {
  it('uses a calm four-frame pulse', () => {
    expect([
      resolvePersonalityPulseGlyph(0),
      resolvePersonalityPulseGlyph(1),
      resolvePersonalityPulseGlyph(2),
      resolvePersonalityPulseGlyph(3),
      resolvePersonalityPulseGlyph(4),
    ]).toEqual(['✦', '·', '✧', '·', '✦']);
  });

  it('only highlights the strip border on the first pulse frame', () => {
    expect(resolvePersonalityBorderColor(0, 'active', 'rest')).toBe('active');
    expect(resolvePersonalityBorderColor(1, 'active', 'rest')).toBe('rest');
    expect(resolvePersonalityBorderColor(4, 'active', 'rest')).toBe('active');
  });

  it('keeps common personalities calmer than legendary ones', () => {
    expect(resolvePersonalityPulseGlyph(0, 'common')).toBe('·');
    expect(resolvePersonalityPulseGlyph(0, 'legendary')).toBe('✹');
    expect(resolvePersonalityBorderColor(4, 'active', 'rest', 'common')).toBe('rest');
    expect(resolvePersonalityBorderColor(4, 'active', 'rest', 'legendary')).toBe('active');
  });

  it('maps rarity to distinct chrome colors', () => {
    const colors = {
      tint: 'tint',
      tintMuted: 'muted',
      activity: 'activity',
      success: 'success',
      info: 'info',
      warning: 'warning',
      destructive: 'destructive',
    };

    expect(resolvePersonalityRarityChrome('common', 0, colors).rarityColor).toBe('muted');
    expect(resolvePersonalityRarityChrome('rare', 0, colors).rarityColor).toBe('info');
    expect(resolvePersonalityRarityChrome('legendary', 0, colors).rarityColor).toBe('warning');
  });
});
