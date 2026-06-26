import { describe, expect, it } from 'bun:test';
import { catppuccin, tokyoNight, type ColorScheme } from '../../app/ui/themes';
import { colorSchemeToCssVars } from './theme-to-css';

const transparentFixture: ColorScheme = {
  ...tokyoNight,
  bg: {
    primary: 'transparent',
    secondary: 'transparent',
    tertiary: 'transparent',
    highlight: 'transparent',
  },
};

describe('colorSchemeToCssVars', () => {
  it('keeps icon backgrounds opaque for transparent themes', () => {
    const vars = colorSchemeToCssVars(transparentFixture);

    expect(vars).toContain('--bg-secondary: transparent');
    expect(vars).toContain('--surface-background: transparent');
    expect(vars).toContain('--icon-background: #24283b');
    expect(vars).toContain('--scrollbar-track: transparent');
  });

  it('uses the theme card background for non-transparent icon backgrounds', () => {
    const vars = colorSchemeToCssVars(catppuccin);

    expect(vars).toContain(`--page-background: ${catppuccin.bg.primary}`);
    expect(vars).toContain(`--surface-background: ${catppuccin.bg.secondary}`);
    expect(vars).toContain(`--icon-background: ${catppuccin.bg.secondary}`);
  });
});
