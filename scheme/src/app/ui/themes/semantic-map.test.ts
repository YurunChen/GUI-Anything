import { describe, expect, it } from 'bun:test';
import { appleSystemDark } from './apple-system';
import { buildSemanticColors } from './semantic-map';

describe('buildSemanticColors', () => {
  it('maps scheme fg/bg to semantic labels and fills', () => {
    const semantic = buildSemanticColors(appleSystemDark);
    expect(semantic.label.primary).toBe(appleSystemDark.fg.primary);
    expect(semantic.fill.base).toBe(appleSystemDark.bg.primary);
    expect(semantic.tint).toBe(appleSystemDark.accent.primary);
    expect(semantic.activity).toBe(appleSystemDark.fg.secondary);
    expect(semantic.destructive).toBe(appleSystemDark.status.error);
  });
});
