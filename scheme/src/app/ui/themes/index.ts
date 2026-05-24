/**
 * Theme System - 支持多种配色方案
 */

export interface ColorScheme {
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    highlight: string;
  };
  fg: {
    primary: string;
    secondary: string;
    muted: string;
    dim: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  accent: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  border: {
    normal: string;
    active: string;
    muted: string;
  };
  wiki: {
    background: string;
    titleColor: string;
    labelColor: string;
    matchColor: string;
    contentColor: string;
    tagColor: string;
  };
}

// Tokyo Night - 深蓝灰色主题（原版）
export const tokyoNight: ColorScheme = {
  bg: {
    primary: '#1a1b26',
    secondary: '#24283b',
    tertiary: '#1f2335',
    highlight: '#3d4259',
  },
  fg: {
    primary: '#c0caf5',
    secondary: '#a9b1d6',
    muted: '#565f89',
    dim: '#3b4261',
  },
  status: {
    success: '#9ece6a',
    warning: '#e0af68',
    error: '#f7768e',
    info: '#7aa2f7',
  },
  accent: {
    primary: '#7aa2f7',
    secondary: '#bb9af7',
    tertiary: '#7dcfff',
  },
  border: {
    normal: '#3d4259',
    active: '#7aa2f7',
    muted: '#2f3449',
  },
  wiki: {
    background: '#2a2f3f',
    titleColor: '#ffc777',
    labelColor: '#c099ff',
    matchColor: '#73daca',
    contentColor: '#a9b1d6',
    tagColor: '#bb9af7',
  },
};

// Nord - 冷色系蓝灰主题
export const nord: ColorScheme = {
  bg: {
    primary: '#2e3440',
    secondary: '#3b4252',
    tertiary: '#434c5e',
    highlight: '#4c566a',
  },
  fg: {
    primary: '#eceff4',
    secondary: '#e5e9f0',
    muted: '#d8dee9',
    dim: '#4c566a',
  },
  status: {
    success: '#a3be8c',
    warning: '#ebcb8b',
    error: '#bf616a',
    info: '#81a1c1',
  },
  accent: {
    primary: '#88c0d0',
    secondary: '#b48ead',
    tertiary: '#5e81ac',
  },
  border: {
    normal: '#4c566a',
    active: '#88c0d0',
    muted: '#3b4252',
  },
  wiki: {
    background: '#3b4252',
    titleColor: '#88c0d0',
    labelColor: '#b48ead',
    matchColor: '#a3be8c',
    contentColor: '#e5e9f0',
    tagColor: '#81a1c1',
  },
};

// Catppuccin Mocha - 温暖的紫粉色主题
export const catppuccin: ColorScheme = {
  bg: {
    primary: '#1e1e2e',
    secondary: '#313244',
    tertiary: '#45475a',
    highlight: '#585b70',
  },
  fg: {
    primary: '#cdd6f4',
    secondary: '#bac2de',
    muted: '#a6adc8',
    dim: '#585b70',
  },
  status: {
    success: '#a6e3a1',
    warning: '#f9e2af',
    error: '#f38ba8',
    info: '#89b4fa',
  },
  accent: {
    primary: '#89dceb',
    secondary: '#cba6f7',
    tertiary: '#f5c2e7',
  },
  border: {
    normal: '#585b70',
    active: '#89dceb',
    muted: '#45475a',
  },
  wiki: {
    background: '#313244',
    titleColor: '#f9e2af',
    labelColor: '#cba6f7',
    matchColor: '#a6e3a1',
    contentColor: '#cdd6f4',
    tagColor: '#f5c2e7',
  },
};

// Dracula - 经典紫色主题
export const dracula: ColorScheme = {
  bg: {
    primary: '#282a36',
    secondary: '#44475a',
    tertiary: '#373844',
    highlight: '#6272a4',
  },
  fg: {
    primary: '#f8f8f2',
    secondary: '#e6e6e6',
    muted: '#6272a4',
    dim: '#44475a',
  },
  status: {
    success: '#50fa7b',
    warning: '#f1fa8c',
    error: '#ff5555',
    info: '#8be9fd',
  },
  accent: {
    primary: '#bd93f9',
    secondary: '#ff79c6',
    tertiary: '#8be9fd',
  },
  border: {
    normal: '#6272a4',
    active: '#bd93f9',
    muted: '#44475a',
  },
  wiki: {
    background: '#44475a',
    titleColor: '#f1fa8c',
    labelColor: '#bd93f9',
    matchColor: '#50fa7b',
    contentColor: '#f8f8f2',
    tagColor: '#ff79c6',
  },
};

// Gruvbox Dark - 复古暖色主题
export const gruvbox: ColorScheme = {
  bg: {
    primary: '#282828',
    secondary: '#3c3836',
    tertiary: '#504945',
    highlight: '#665c54',
  },
  fg: {
    primary: '#ebdbb2',
    secondary: '#d5c4a1',
    muted: '#bdae93',
    dim: '#7c6f64',
  },
  status: {
    success: '#b8bb26',
    warning: '#fabd2f',
    error: '#fb4934',
    info: '#83a598',
  },
  accent: {
    primary: '#fe8019',
    secondary: '#d3869b',
    tertiary: '#8ec07c',
  },
  border: {
    normal: '#665c54',
    active: '#fe8019',
    muted: '#504945',
  },
  wiki: {
    background: '#3c3836',
    titleColor: '#fabd2f',
    labelColor: '#d3869b',
    matchColor: '#b8bb26',
    contentColor: '#ebdbb2',
    tagColor: '#83a598',
  },
};

// Solarized Dark - 经典低对比度主题
export const solarized: ColorScheme = {
  bg: {
    primary: '#002b36',
    secondary: '#073642',
    tertiary: '#073642',
    highlight: '#586e75',
  },
  fg: {
    primary: '#fdf6e3',
    secondary: '#eee8d5',
    muted: '#93a1a1',
    dim: '#586e75',
  },
  status: {
    success: '#859900',
    warning: '#b58900',
    error: '#dc322f',
    info: '#268bd2',
  },
  accent: {
    primary: '#2aa198',
    secondary: '#6c71c4',
    tertiary: '#cb4b16',
  },
  border: {
    normal: '#586e75',
    active: '#2aa198',
    muted: '#073642',
  },
  wiki: {
    background: '#073642',
    titleColor: '#b58900',
    labelColor: '#6c71c4',
    matchColor: '#859900',
    contentColor: '#eee8d5',
    tagColor: '#2aa198',
  },
};

// One Dark - Atom 经典主题
export const oneDark: ColorScheme = {
  bg: {
    primary: '#282c34',
    secondary: '#21252b',
    tertiary: '#2c313a',
    highlight: '#3e4451',
  },
  fg: {
    primary: '#abb2bf',
    secondary: '#9da5b4',
    muted: '#5c6370',
    dim: '#3e4451',
  },
  status: {
    success: '#98c379',
    warning: '#e5c07b',
    error: '#e06c75',
    info: '#61afef',
  },
  accent: {
    primary: '#61afef',
    secondary: '#c678dd',
    tertiary: '#56b6c2',
  },
  border: {
    normal: '#3e4451',
    active: '#61afef',
    muted: '#2c313a',
  },
  wiki: {
    background: '#2c313a',
    titleColor: '#e5c07b',
    labelColor: '#c678dd',
    matchColor: '#98c379',
    contentColor: '#abb2bf',
    tagColor: '#56b6c2',
  },
};

// ========== 浅色主题 ==========

// Solarized Light - 经典浅色主题
export const solarizedLight: ColorScheme = {
  bg: {
    primary: '#fdf6e3',
    secondary: '#eee8d5',
    tertiary: '#eee8d5',
    highlight: '#93a1a1',
  },
  fg: {
    primary: '#002b36',
    secondary: '#073642',
    muted: '#586e75',
    dim: '#93a1a1',
  },
  status: {
    success: '#859900',
    warning: '#b58900',
    error: '#dc322f',
    info: '#268bd2',
  },
  accent: {
    primary: '#2aa198',
    secondary: '#6c71c4',
    tertiary: '#cb4b16',
  },
  border: {
    normal: '#93a1a1',
    active: '#2aa198',
    muted: '#eee8d5',
  },
  wiki: {
    background: '#eee8d5',
    titleColor: '#b58900',
    labelColor: '#6c71c4',
    matchColor: '#859900',
    contentColor: '#073642',
    tagColor: '#2aa198',
  },
};

// Gruvbox Light - 复古暖色浅色主题
export const gruvboxLight: ColorScheme = {
  bg: {
    primary: '#fbf1c7',
    secondary: '#ebdbb2',
    tertiary: '#d5c4a1',
    highlight: '#bdae93',
  },
  fg: {
    primary: '#3c3836',
    secondary: '#504945',
    muted: '#665c54',
    dim: '#928374',
  },
  status: {
    success: '#79740e',
    warning: '#b57614',
    error: '#cc241d',
    info: '#076678',
  },
  accent: {
    primary: '#af3a03',
    secondary: '#8f3f71',
    tertiary: '#427b58',
  },
  border: {
    normal: '#bdae93',
    active: '#af3a03',
    muted: '#d5c4a1',
  },
  wiki: {
    background: '#ebdbb2',
    titleColor: '#b57614',
    labelColor: '#8f3f71',
    matchColor: '#79740e',
    contentColor: '#3c3836',
    tagColor: '#076678',
  },
};

// Catppuccin Latte - 温暖的浅色主题
export const catppuccinLatte: ColorScheme = {
  bg: {
    primary: '#eff1f5',
    secondary: '#e6e9ef',
    tertiary: '#dce0e8',
    highlight: '#ccd0da',
  },
  fg: {
    primary: '#4c4f69',
    secondary: '#5c5f77',
    muted: '#6c6f85',
    dim: '#9ca0b0',
  },
  status: {
    success: '#40a02b',
    warning: '#df8e1d',
    error: '#d20f39',
    info: '#1e66f5',
  },
  accent: {
    primary: '#04a5e5',
    secondary: '#8839ef',
    tertiary: '#ea76cb',
  },
  border: {
    normal: '#ccd0da',
    active: '#04a5e5',
    muted: '#dce0e8',
  },
  wiki: {
    background: '#e6e9ef',
    titleColor: '#df8e1d',
    labelColor: '#8839ef',
    matchColor: '#40a02b',
    contentColor: '#4c4f69',
    tagColor: '#ea76cb',
  },
};

// GitHub Light - 清爽白色主题
export const githubLight: ColorScheme = {
  bg: {
    primary: '#ffffff',
    secondary: '#f6f8fa',
    tertiary: '#f6f8fa',
    highlight: '#e1e4e8',
  },
  fg: {
    primary: '#24292e',
    secondary: '#586069',
    muted: '#6a737d',
    dim: '#959da5',
  },
  status: {
    success: '#28a745',
    warning: '#ffd33d',
    error: '#d73a49',
    info: '#0366d6',
  },
  accent: {
    primary: '#0366d6',
    secondary: '#6f42c1',
    tertiary: '#005cc5',
  },
  border: {
    normal: '#e1e4e8',
    active: '#0366d6',
    muted: '#f6f8fa',
  },
  wiki: {
    background: '#f6f8fa',
    titleColor: '#e36209',
    labelColor: '#6f42c1',
    matchColor: '#28a745',
    contentColor: '#24292e',
    tagColor: '#0366d6',
  },
};

// ========== 彩色主题 ==========

// Monokai - 经典鲜艳主题
export const monokai: ColorScheme = {
  bg: {
    primary: '#272822',
    secondary: '#3e3d32',
    tertiary: '#49483e',
    highlight: '#75715e',
  },
  fg: {
    primary: '#f8f8f2',
    secondary: '#f8f8f0',
    muted: '#75715e',
    dim: '#49483e',
  },
  status: {
    success: '#a6e22e',
    warning: '#e6db74',
    error: '#f92672',
    info: '#66d9ef',
  },
  accent: {
    primary: '#ae81ff',
    secondary: '#f92672',
    tertiary: '#fd971f',
  },
  border: {
    normal: '#49483e',
    active: '#ae81ff',
    muted: '#3e3d32',
  },
  wiki: {
    background: '#3e3d32',
    titleColor: '#e6db74',
    labelColor: '#ae81ff',
    matchColor: '#a6e22e',
    contentColor: '#f8f8f2',
    tagColor: '#66d9ef',
  },
};

// Synthwave - 赛博朋克风格
export const synthwave: ColorScheme = {
  bg: {
    primary: '#2a2139',
    secondary: '#241b2f',
    tertiary: '#34294f',
    highlight: '#495495',
  },
  fg: {
    primary: '#f92aad',
    secondary: '#ffffff',
    muted: '#848bbd',
    dim: '#495495',
  },
  status: {
    success: '#72f1b8',
    warning: '#fede5d',
    error: '#ff7edb',
    info: '#36f9f6',
  },
  accent: {
    primary: '#ff7edb',
    secondary: '#fe4450',
    tertiary: '#72f1b8',
  },
  border: {
    normal: '#495495',
    active: '#ff7edb',
    muted: '#34294f',
  },
  wiki: {
    background: '#34294f',
    titleColor: '#fede5d',
    labelColor: '#ff7edb',
    matchColor: '#72f1b8',
    contentColor: '#ffffff',
    tagColor: '#36f9f6',
  },
};

// Ocean - 海洋蓝主题
export const ocean: ColorScheme = {
  bg: {
    primary: '#0d1117',
    secondary: '#161b22',
    tertiary: '#21262d',
    highlight: '#30363d',
  },
  fg: {
    primary: '#c9d1d9',
    secondary: '#8b949e',
    muted: '#6e7681',
    dim: '#484f58',
  },
  status: {
    success: '#3fb950',
    warning: '#d29922',
    error: '#f85149',
    info: '#58a6ff',
  },
  accent: {
    primary: '#1f6feb',
    secondary: '#a371f7',
    tertiary: '#56d364',
  },
  border: {
    normal: '#30363d',
    active: '#1f6feb',
    muted: '#21262d',
  },
  wiki: {
    background: '#161b22',
    titleColor: '#f0883e',
    labelColor: '#a371f7',
    matchColor: '#56d364',
    contentColor: '#c9d1d9',
    tagColor: '#58a6ff',
  },
};

// 导入莫兰迪色系 V2（每个 hue 都提供 light + dark 两个版本，共 16 个）
import {
  sakuraPinkLight, sakuraPinkDark,
  sageGreenLight,  sageGreenDark,
  lavenderLight,   lavenderDark,
  mistyBlueLight,  mistyBlueDark,
  milkTeaLight,    milkTeaDark,
  lotusPinkLight,  lotusPinkDark,
  matchaLight,     matchaDark,
  peachLight,      peachDark,
} from './morandi-v2';

export type ThemeName =
  | 'tokyo-night' | 'nord' | 'catppuccin' | 'dracula' | 'gruvbox' | 'solarized' | 'one-dark'
  | 'solarized-light' | 'gruvbox-light' | 'catppuccin-latte' | 'github-light'
  | 'monokai' | 'synthwave' | 'ocean'
  | 'sakura-pink-light' | 'sakura-pink-dark'
  | 'sage-green-light'  | 'sage-green-dark'
  | 'lavender-light'    | 'lavender-dark'
  | 'misty-blue-light'  | 'misty-blue-dark'
  | 'milk-tea-light'    | 'milk-tea-dark'
  | 'lotus-pink-light'  | 'lotus-pink-dark'
  | 'matcha-light'      | 'matcha-dark'
  | 'peach-light'       | 'peach-dark';

export const themes: Record<ThemeName, ColorScheme> = {
  // 深色主题
  'tokyo-night': tokyoNight,
  'nord': nord,
  'catppuccin': catppuccin,
  'dracula': dracula,
  'gruvbox': gruvbox,
  'solarized': solarized,
  'one-dark': oneDark,
  // 浅色主题
  'solarized-light': solarizedLight,
  'gruvbox-light': gruvboxLight,
  'catppuccin-latte': catppuccinLatte,
  'github-light': githubLight,
  // 彩色主题
  'monokai': monokai,
  'synthwave': synthwave,
  'ocean': ocean,
  // 莫兰迪色系 V2 — 每个 hue 都有 light/dark 两版（共 16 个）
  'sakura-pink-light': sakuraPinkLight,
  'sakura-pink-dark':  sakuraPinkDark,
  'sage-green-light':  sageGreenLight,
  'sage-green-dark':   sageGreenDark,
  'lavender-light':    lavenderLight,
  'lavender-dark':     lavenderDark,
  'misty-blue-light':  mistyBlueLight,
  'misty-blue-dark':   mistyBlueDark,
  'milk-tea-light':    milkTeaLight,
  'milk-tea-dark':     milkTeaDark,
  'lotus-pink-light':  lotusPinkLight,
  'lotus-pink-dark':   lotusPinkDark,
  'matcha-light':      matchaLight,
  'matcha-dark':       matchaDark,
  'peach-light':       peachLight,
  'peach-dark':        peachDark,
};

// 旧的不带后缀的名字 → 等价于 -light 版（兼容老配置文件）
const LEGACY_THEME_ALIASES: Record<string, ThemeName> = {
  'sakura-pink': 'sakura-pink-light',
  'sage-green':  'sage-green-light',
  'lavender':    'lavender-light',
  'misty-blue':  'misty-blue-light',
  'milk-tea':    'milk-tea-light',
  'lotus-pink':  'lotus-pink-light',
  'matcha':      'matcha-light',
  'peach':       'peach-light',
};

/** 解析主题名（处理旧配置中的不带 -light/-dark 后缀的别名） */
export function resolveThemeName(name: string): ThemeName | undefined {
  if (name in themes) return name as ThemeName;
  if (name in LEGACY_THEME_ALIASES) return LEGACY_THEME_ALIASES[name];
  return undefined;
}

// 从环境变量获取主题，默认为 tokyo-night
export function getActiveTheme(): ColorScheme {
  const raw = process.env.FLOW_THEME || 'tokyo-night';
  const resolved = resolveThemeName(raw);
  return resolved ? themes[resolved] : tokyoNight;
}
