import { describe, expect, it } from 'bun:test';
import { themes, type ThemeName } from './index';
import {
  buildResolvedTuiTheme,
  resolveWorkspaceActivityToken,
} from './resolved-theme';

describe('buildResolvedTuiTheme', () => {
  for (const themeName of Object.keys(themes) as ThemeName[]) {
    it(`${themeName} resolves a full TUI presentation package`, () => {
      const theme = buildResolvedTuiTheme(themeName);

      expect(theme.name).toBe(themeName);
      expect(theme.colors).toBe(themes[themeName]);
      expect(theme.semantic.fill.base).toBe(themes[themeName].bg.primary);
      expect(theme.chrome.spinnerFrames.length).toBeGreaterThan(0);
      expect(theme.motion.spinnerIntervalMs).toBe(theme.chrome.spinnerIntervalMs);

      expect(theme.modes.timeline.cardFills.base).toBe(theme.semantic.fill.base);
      expect(theme.modes.focus.glyphs.trunk).toBe('│');
      expect(theme.modes.workspace.tree.directory.glyph.length).toBeGreaterThan(0);
      expect(theme.modes.workspace.action.edit.glyph).toBeTruthy();
      expect(theme.modes.wiki.tagColors.length).toBeGreaterThanOrEqual(4);
      expect(theme.modes.statusBar.borderColor).toBe(theme.semantic.separator);
      expect(theme.modes.commandBar.textFg).toBeTruthy();
    });
  }

  it('resolves workspace activity status before action color', () => {
    const theme = buildResolvedTuiTheme('transparent');

    expect(resolveWorkspaceActivityToken(theme, 'edit', 'error', 0).glyph).toBe('!');
    expect(resolveWorkspaceActivityToken(theme, 'write', 'ok', 0).glyph).toBe('✓');
    expect(resolveWorkspaceActivityToken(theme, 'search', 'idle', 0).glyph).toBe('⌕');
    expect(resolveWorkspaceActivityToken(theme, 'edit', 'running', 1).glyph)
      .toBe(theme.chrome.spinnerFrames[1]);
  });

  it('keeps transparent outer surfaces but fills the knowledge panel', () => {
    const theme = buildResolvedTuiTheme('transparent');

    expect(theme.semantic.fill.base).toBe('transparent');
    expect(theme.modes.timeline.cardFills.grouped).toBe('transparent');
    expect(theme.modes.wiki.panel.backgroundColor).not.toBe('transparent');
  });
});
