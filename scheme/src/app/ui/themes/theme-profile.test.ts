import { describe, expect, it } from 'bun:test';
import { themes } from './index';
import {
  CHROME_PROFILES,
  defineChromeProfile,
} from './theme-profile-registry';
import { validateThemeChromeRegistry } from './theme-style-registry';
import {
  formatThemeSectionLabel,
  resolveCardBorderChrome,
  resolveCardShellChrome,
  resolveKnowledgeInsetChrome,
  resolveKineticSpinner,
  resolveSpinnerFrame,
  resolveThemeChrome,
  resolveThemeProfile,
} from './theme-profile';

describe('validateThemeChromeRegistry', () => {
  it('binds every registered color theme to chrome', () => {
    expect(validateThemeChromeRegistry()).toEqual([]);
    expect(Object.keys(themes)).toContain('transparent');
    expect(Object.keys(themes)).toContain('tokyo-night');
    expect(Object.keys(themes)).toContain('catppuccin');
  });
});

describe('defineChromeProfile', () => {
  it('merges overrides onto calm defaults', () => {
    const custom = defineChromeProfile('calm', {
      sectionSummaryPrefix: '>> ',
    });
    expect(custom.id).toBe('calm');
    expect(custom.sectionSummaryPrefix).toBe('>> ');
    expect(custom.spinnerIntervalMs).toBe(120);
  });
});

describe('resolveThemeProfile', () => {
  it('returns theme colors with shared chrome', () => {
    const tokyoProfile = resolveThemeProfile('transparent');
    const catppuccinProfile = resolveThemeProfile('catppuccin');
    expect(tokyoProfile.colors.bg.primary).toBe('transparent');
    expect(catppuccinProfile.colors.bg.primary).toBe('#1e1e2e');
    expect(catppuccinProfile.chrome).toBe(tokyoProfile.chrome);
    expect(catppuccinProfile.chrome.id).toBe('calm');
    expect(catppuccinProfile.chrome.cardLayout).toBe('classic');
  });

  it('formats section labels via chrome preset', () => {
    const chrome = CHROME_PROFILES.calm;
    expect(formatThemeSectionLabel(chrome, 'summary', 'Summary')).toBe('SUMMARY');
    expect(formatThemeSectionLabel(chrome, 'knowledge', 'Knowledge')).toBe('KNOWLEDGE');
  });
});

describe('resolveSpinnerFrame', () => {
  it('cycles frames by index', () => {
    const chrome = resolveThemeChrome('transparent');
    expect(resolveSpinnerFrame(chrome, 0)).toBe('⠋');
    expect(resolveSpinnerFrame(chrome, 1)).toBe('⠙');
  });
});

describe('kinetic helpers', () => {
  it('keeps the default running signal on the spinner channel', () => {
    const chrome = resolveThemeChrome('transparent');
    expect(resolveKineticSpinner(chrome, '⠋', 2, true)).toBe('⠋');
    expect(resolveKineticSpinner(chrome, '⠋', 2, false)).toBe('⠋');
  });

  it('uses dynamic border frames only when chrome provides them', () => {
    const chrome = {
      ...resolveThemeChrome('transparent'),
      cardBorderAccentFrames: ['#111', '#222'],
    };
    const border = resolveCardBorderChrome(
      chrome,
      { accent: true, fresh: false, focused: false },
      { tint: '#aaa', activity: '#bbb', separator: '#ccc', tintMuted: '#999' },
      1,
    );
    expect(border.borderColor).toBe('#222');
  });
});

describe('resolveCardShellChrome', () => {
  it('renders the left-rail card shell for the default theme', () => {
    const chrome = resolveThemeChrome('transparent');
    const shell = resolveCardShellChrome(
      chrome,
      { accent: false, fresh: false, focused: false },
      shellFills(),
    );
    expect(shell.layout).toBe('classic');
    expect(shell.backgroundColor).toBe('#222');
    expect(shell.border).toEqual(['left']);
    expect(shell.borderColor).toBe('#444');
    expect(shell.borderStyle).toBe('single');
    expect(shell.padX).toBe(2);
    expect(shell.padY).toBe(1);
    expect(shell.gap).toBe(2);
    expect(shell.knowledgeInset).toBe('full-box');
  });

  it('renders panel and ledger layouts with stable borders for layout helper coverage', () => {
    const fills = shellFills();
    const baseChrome = resolveThemeChrome('transparent');
    const panelIdle = resolveCardShellChrome(
      { ...baseChrome, cardLayout: 'panel' },
      { accent: false, fresh: false, focused: false },
      fills,
    );
    const panelActive = resolveCardShellChrome(
      { ...baseChrome, cardLayout: 'panel' },
      { accent: true, fresh: false, focused: false },
      fills,
    );
    expect(panelIdle.border).toEqual(['top', 'bottom']);
    expect(panelActive.border).toEqual(panelIdle.border);

    const ledgerIdle = resolveCardShellChrome(
      { ...baseChrome, cardLayout: 'ledger' },
      { accent: false, fresh: false, focused: false },
      fills,
    );
    const ledgerActive = resolveCardShellChrome(
      { ...baseChrome, cardLayout: 'ledger' },
      { accent: true, fresh: false, focused: false },
      fills,
    );
    expect(ledgerIdle.border).toEqual(['top']);
    expect(ledgerActive.border).toEqual(ledgerIdle.border);
  });

  it('highlights the focused latest card and dims historical cards', () => {
    const chrome = resolveThemeChrome('transparent');
    const fills = shellFills();
    const latest = resolveCardShellChrome(
      chrome,
      { accent: false, fresh: false, focused: true },
      fills,
    );
    const historical = resolveCardShellChrome(
      chrome,
      { accent: false, fresh: false, focused: false },
      fills,
    );
    expect(latest.border).toEqual(['left']);
    expect(historical.border).toEqual(['left']);
    expect(latest.borderColor).toBe(fills.tint);
    expect(historical.borderColor).toBe(fills.separator);
  });
});

describe('resolveKnowledgeInsetChrome', () => {
  it('renders the default knowledge inset as a filled panel without an inner border', () => {
    const chrome = resolveThemeChrome('transparent');
    const inset = resolveKnowledgeInsetChrome(
      chrome,
      'knowledge',
      {
        wikiBackground: '#202436',
        elevated: '#333',
        separator: '#444',
      },
    );

    expect(inset.border).toBe(false);
    expect(inset.backgroundColor).toBe('#202436');
    expect(inset.padX).toBe(2);
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
