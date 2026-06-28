import { describe, expect, it } from 'bun:test';
import type { ThemeName } from './index';
import { resolveThemeName, themes } from './index';
import { buildResolvedTuiTheme } from './resolved-theme';
import { resolveCardShellChrome, resolveThemeChrome, resolveThemeProfile } from './theme-profile';
import { THEME_STYLES } from './theme-style-registry';
import { validateThemeChromeRegistry } from './theme-style-registry';

describe('theme design matrix', () => {
  it('registers the committed color theme list', () => {
    expect(Object.keys(themes)).toContain('tokyo-night');
    expect(Object.keys(themes)).toContain('transparent');
    expect(Object.keys(themes)).toContain('catppuccin');
    expect(Object.keys(themes)).toContain('github-light');
    expect(Object.keys(themes)).toContain('sakura-pink-light');
    expect(validateThemeChromeRegistry()).toEqual([]);
  });

  it('uses the same style and card shell for every color theme', () => {
    const themeNames = Object.keys(themes) as ThemeName[];
    const first = resolveThemeProfile(themeNames[0]);

    for (const themeName of themeNames) {
      const profile = resolveThemeProfile(themeName);
      expect(profile.style).toBe(first.style);
      expect(profile.chrome).toBe(first.chrome);
      expect(profile.style.family).toBe('terminal');
      expect(profile.chrome.cardLayout).toBe('classic');
      expect(THEME_STYLES[themeName].meta.familyLabel).toBe('Terminal');
      expect(THEME_STYLES[themeName].meta.switchFrames.length).toBeGreaterThan(0);

      const resolved = buildResolvedTuiTheme(themeName);
      expect(resolved.style.family).toBe('terminal');
      expect(resolved.modes.timeline.cardFills.base).toBe(resolved.semantic.fill.base);
      expect(resolved.modes.focus.panel.backgroundColor).toBe(resolved.semantic.fill.base);
      expect(resolved.modes.workspace.action.write.fg).toBeTruthy();
    }
  });

  it('uses the left-rail card shell for the default theme', () => {
    const themeName: ThemeName = 'transparent';
    const profile = resolveThemeProfile(themeName);

    expect(profile.colors).toBe(themes.transparent);
    expect(profile.chrome.cardLayout).toBe('classic');
  });

  it('keeps latest vs historical card topology stable', () => {
    const chrome = resolveThemeChrome('transparent');
    const fills = shellFills();
    const historical = resolveCardShellChrome(chrome, { focused: false }, fills);
    const latest = resolveCardShellChrome(chrome, { focused: true }, fills);

    expect(historical.layout).toBe('classic');
    expect(latest.border).toEqual(historical.border);
    expect(latest.borderStyle).toBe(historical.borderStyle);
    expect(latest.padX).toBe(historical.padX);
    expect(historical.borderColor).not.toBe(latest.borderColor);
  });

  it('uses the committed legacy morandi aliases only', () => {
    expect(resolveThemeName('catppuccin')).toBe('catppuccin');
    expect(resolveThemeName('transparent')).toBe('transparent');
    expect(resolveThemeName('tokyo-night')).toBe('tokyo-night');
    expect(resolveThemeName('sakura-pink')).toBe('sakura-pink-light');
    expect(resolveThemeName('spectra')).toBeUndefined();
  });
});

function shellFills() {
  return {
    grouped: '#222',
    base: '#111',
    elevated: '#333',
    separator: '#444',
    tint: '#0af',
    tintMuted: '#08a',
    activity: '#fa0',
  };
}
