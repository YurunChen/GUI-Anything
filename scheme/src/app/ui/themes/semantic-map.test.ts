import { describe, expect, it } from 'bun:test';
import { appleSystemDark } from './apple-system';
import { tokyoNight } from './index';
import { buildSemanticColors } from './semantic-map';

describe('buildSemanticColors', () => {
  it('maps scheme fg/bg to semantic labels and fills', () => {
    const semantic = buildSemanticColors(appleSystemDark);
    expect(semantic.label.primary).toBe(appleSystemDark.fg.primary);
    expect(semantic.fill.base).toBe(appleSystemDark.bg.primary);
    expect(semantic.tint).toBe(appleSystemDark.accent.primary);
    expect(semantic.activity).toBe(appleSystemDark.fg.secondary);
    expect(semantic.destructive).toBe(appleSystemDark.status.error);
    expect(semantic.warning).toBe(appleSystemDark.status.warning);
    expect(semantic.success).toBe(appleSystemDark.status.success);
    expect(semantic.info).toBe(appleSystemDark.status.info);
  });

  it('maps tokyo night status aliases for current mode tokens', () => {
    const semantic = buildSemanticColors(tokyoNight);
    expect(semantic.fill.base).toBe('#1a1b26');
    expect(semantic.success).toBe(tokyoNight.status.success);
    expect(semantic.info).toBe(tokyoNight.status.info);
  });
});
