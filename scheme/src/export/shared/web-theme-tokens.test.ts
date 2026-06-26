import { describe, expect, it } from 'bun:test';
import { catppuccin, tokyoNight, type ColorScheme } from '../../app/ui/themes';
import { buildWebThemeTokens } from './web-theme-tokens';

const transparentFixture: ColorScheme = {
  ...tokyoNight,
  bg: {
    primary: 'transparent',
    secondary: 'transparent',
    tertiary: 'transparent',
    highlight: 'transparent',
  },
  wiki: {
    ...tokyoNight.wiki,
    background: 'transparent',
  },
};

describe('buildWebThemeTokens', () => {
  it('keeps transparent surfaces transparent while preserving opaque affordances', () => {
    const tokens = buildWebThemeTokens(transparentFixture);

    expect(tokens.pageBackground).toBe('transparent');
    expect(tokens.surfaceBackground).toBe('transparent');
    expect(tokens.surfaceMuted).toBe('transparent');
    expect(tokens.iconBackground).toBe('#24283b');
    expect(tokens.scrollbarTrack).toBe('transparent');
    expect(tokens.scrollbarThumb).toContain(tokyoNight.accent.primary);
  });

  it('uses regular theme surfaces for opaque web exports', () => {
    const tokens = buildWebThemeTokens(catppuccin);

    expect(tokens.pageBackground).toBe(catppuccin.bg.primary);
    expect(tokens.surfaceBackground).toBe(catppuccin.bg.secondary);
    expect(tokens.surfaceStrong).toBe(catppuccin.bg.tertiary);
    expect(tokens.iconBackground).toBe(catppuccin.bg.secondary);
    expect(tokens.scrollbarTrack).toContain(catppuccin.bg.secondary);
  });
});
