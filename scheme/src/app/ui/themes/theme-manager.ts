/**
 * Theme Manager - 运行时主题切换
 */

import type { ThemeName, ColorScheme } from './index';
import { themes, resolveThemeName } from './index';
import { getDefaultTheme, saveThemeConfig } from './theme-config';

// 莫兰迪 16 主题循环顺序：每个 hue 的 light/dark 相邻，方便用户感知"同色调更深"
const MORANDI_THEMES: ThemeName[] = [
  'sakura-pink-light', 'sakura-pink-dark',
  'sage-green-light',  'sage-green-dark',
  'lavender-light',    'lavender-dark',
  'misty-blue-light',  'misty-blue-dark',
  'milk-tea-light',    'milk-tea-dark',
  'lotus-pink-light',  'lotus-pink-dark',
  'matcha-light',      'matcha-dark',
  'peach-light',       'peach-dark',
];

// 每个 morandi 主题对应的 light/dark 配对
const LIGHT_DARK_PAIR: Partial<Record<ThemeName, ThemeName>> = {
  'sakura-pink-light': 'sakura-pink-dark',
  'sakura-pink-dark':  'sakura-pink-light',
  'sage-green-light':  'sage-green-dark',
  'sage-green-dark':   'sage-green-light',
  'lavender-light':    'lavender-dark',
  'lavender-dark':     'lavender-light',
  'misty-blue-light':  'misty-blue-dark',
  'misty-blue-dark':   'misty-blue-light',
  'milk-tea-light':    'milk-tea-dark',
  'milk-tea-dark':     'milk-tea-light',
  'lotus-pink-light':  'lotus-pink-dark',
  'lotus-pink-dark':   'lotus-pink-light',
  'matcha-light':      'matcha-dark',
  'matcha-dark':       'matcha-light',
  'peach-light':       'peach-dark',
  'peach-dark':        'peach-light',
};

class ThemeManager {
  private currentTheme: ThemeName;
  private listeners: Array<(theme: ColorScheme) => void> = [];

  constructor() {
    this.currentTheme = getDefaultTheme();
  }

  getCurrentTheme(): ThemeName {
    return this.currentTheme;
  }

  getColors(): ColorScheme {
    return themes[this.currentTheme] || themes['tokyo-night'];
  }

  setTheme(themeName: ThemeName | string): void {
    // 接受旧的不带 -light 后缀的名字（如 'sakura-pink' → 'sakura-pink-light'）
    const resolved = resolveThemeName(themeName);
    if (resolved) {
      this.currentTheme = resolved;
      saveThemeConfig(resolved);
      this.notifyListeners();
    }
  }

  nextTheme(): ThemeName {
    const themeNames = Object.keys(themes) as ThemeName[];
    const currentIndex = themeNames.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    this.currentTheme = themeNames[nextIndex];
    saveThemeConfig(this.currentTheme);
    this.notifyListeners();
    return this.currentTheme;
  }

  previousTheme(): ThemeName {
    const themeNames = Object.keys(themes) as ThemeName[];
    const currentIndex = themeNames.indexOf(this.currentTheme);
    const prevIndex = (currentIndex - 1 + themeNames.length) % themeNames.length;
    this.currentTheme = themeNames[prevIndex];
    saveThemeConfig(this.currentTheme);
    this.notifyListeners();
    return this.currentTheme;
  }

  /** 在 16 个 morandi 主题之间循环（不在 morandi 系列中则跳到第一个） */
  nextMorandiTheme(): ThemeName {
    const currentIndex = MORANDI_THEMES.indexOf(this.currentTheme);
    if (currentIndex === -1) {
      this.currentTheme = MORANDI_THEMES[0];
    } else {
      const nextIndex = (currentIndex + 1) % MORANDI_THEMES.length;
      this.currentTheme = MORANDI_THEMES[nextIndex];
    }
    saveThemeConfig(this.currentTheme);
    this.notifyListeners();
    return this.currentTheme;
  }

  /**
   * 切换当前 morandi 主题的 light/dark 变体（保持色调）。
   * 不在 morandi 系列里时，原地不动并返回当前主题。
   */
  toggleLightDark(): ThemeName {
    const pair = LIGHT_DARK_PAIR[this.currentTheme];
    if (pair) {
      this.currentTheme = pair;
      saveThemeConfig(this.currentTheme);
      this.notifyListeners();
    }
    return this.currentTheme;
  }

  subscribe(listener: (theme: ColorScheme) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const colors = this.getColors();
    this.listeners.forEach(listener => listener(colors));
  }

  getThemeDisplayName(themeName?: ThemeName): string {
    const name = themeName || this.currentTheme;
    const names: Record<ThemeName, string> = {
      'tokyo-night': '🌙 Tokyo Night',
      'nord': '❄️ Nord',
      'catppuccin': '🌸 Catppuccin',
      'dracula': '🧛 Dracula',
      'gruvbox': '🔥 Gruvbox',
      'solarized': '☀️ Solarized',
      'one-dark': '🌑 One Dark',
      'solarized-light': '☀️ Solarized Light',
      'gruvbox-light': '🔥 Gruvbox Light',
      'catppuccin-latte': '☕ Catppuccin Latte',
      'github-light': '💡 GitHub Light',
      'monokai': '🎨 Monokai',
      'synthwave': '💜 Synthwave',
      'ocean': '🌊 Ocean',
      'sakura-pink-light': '🌸 樱花粉·浅',
      'sakura-pink-dark':  '🌸 樱花粉·深',
      'sage-green-light':  '🌿 雾霾绿·浅',
      'sage-green-dark':   '🌿 雾霾绿·深',
      'lavender-light':    '💜 薰衣草·浅',
      'lavender-dark':     '💜 薰衣草·深',
      'misty-blue-light':  '🌊 雾霾蓝·浅',
      'misty-blue-dark':   '🌊 雾霾蓝·深',
      'milk-tea-light':    '🍂 奶茶棕·浅',
      'milk-tea-dark':     '🍂 奶茶棕·深',
      'lotus-pink-light':  '🌸 藕粉·浅',
      'lotus-pink-dark':   '🌸 藕粉·深',
      'matcha-light':      '🍵 抹茶·浅',
      'matcha-dark':       '🍵 抹茶·深',
      'peach-light':       '🍑 蜜桃·浅',
      'peach-dark':        '🍑 蜜桃·深',
    };
    return names[name] || name;
  }
}

export const themeManager = new ThemeManager();
