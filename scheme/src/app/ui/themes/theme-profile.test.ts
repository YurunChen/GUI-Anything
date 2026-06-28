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
      { focused: true },
      { tint: '#aaa', activity: '#bbb', separator: '#ccc', tintMuted: '#999' },
      1,
    );
    expect(border.borderColor).toBe('#222');
  });

  it('prefers theme-derived border frames over chrome color frames', () => {
    const chrome = {
      ...resolveThemeChrome('transparent'),
      cardBorderAccentFrames: ['#111', '#222'],
    };
    const border = resolveCardBorderChrome(
      chrome,
      { focused: true },
      {
        tint: '#aaa',
        tintMuted: '#999',
        borderMuted: '#456',
        borderAccentFrames: ['#aaa', '#bbb', '#aaa'],
        activity: '#bbb',
        separator: '#ccc',
      },
      1,
    );
    expect(border.borderColor).toBe('#bbb');
  });
});

describe('resolveCardShellChrome', () => {
  it('renders the left-rail card shell for the default theme', () => {
    const chrome = resolveThemeChrome('transparent');
    const shell = resolveCardShellChrome(
      chrome,
      { focused: false },
      shellFills(),
    );
    expect(shell.layout).toBe('classic');
    expect(shell.backgroundColor).toBe('#222');
    expect(shell.border).toEqual(['left']);
    expect(shell.borderColor).toBe('#456');
    expect(shell.borderStyle).toBe('heavy');
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
      { focused: false },
      fills,
    );
    const panelLatest = resolveCardShellChrome(
      { ...baseChrome, cardLayout: 'panel' },
      { focused: true },
      fills,
    );
    expect(panelIdle.border).toEqual(['top', 'bottom']);
    expect(panelLatest.border).toEqual(panelIdle.border);

    const ledgerIdle = resolveCardShellChrome(
      { ...baseChrome, cardLayout: 'ledger' },
      { focused: false },
      fills,
    );
    const ledgerLatest = resolveCardShellChrome(
      { ...baseChrome, cardLayout: 'ledger' },
      { focused: true },
      fills,
    );
    expect(ledgerIdle.border).toEqual(['top']);
    expect(ledgerLatest.border).toEqual(ledgerIdle.border);
  });

  it('uses two border colors: latest bright, non-latest muted', () => {
    const chrome = resolveThemeChrome('transparent');
    const fills = shellFills();
    const latestA = resolveCardShellChrome(
      chrome,
      { focused: true },
      fills,
    );
    const latestB = resolveCardShellChrome(
      chrome,
      { focused: true },
      fills,
    );
    const historical = resolveCardShellChrome(
      chrome,
      { focused: false },
      fills,
    );
    expect(latestA.border).toEqual(['left']);
    expect(latestB.border).toEqual(['left']);
    expect(latestA.borderColor).toBe(fills.tint);
    expect(latestB.borderColor).toBe(fills.tint);
    expect(historical.borderColor).toBe(fills.borderMuted);
    expect(latestA.borderStyle).toBe('heavy');
    expect(latestB.borderStyle).toBe('heavy');
  });

  it('animates only the latest border color when accent frames are provided', () => {
    const chrome = resolveThemeChrome('transparent');
    const fills = {
      ...shellFills(),
      borderAccentFrames: ['#0af', '#4cf', '#0af'],
    };
    const latest = resolveCardShellChrome(
      chrome,
      { focused: true },
      fills,
      1,
    );
    const historical = resolveCardShellChrome(
      chrome,
      { focused: false },
      fills,
      1,
    );

    expect(latest.borderColor).toBe('#4cf');
    expect(historical.borderColor).toBe(fills.borderMuted);
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
    borderMuted: '#456',
    activity: '#fa0',
  };
}
