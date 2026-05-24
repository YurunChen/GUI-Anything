/**
 * 莫兰迪色系 V2 - 光/暗双版本
 *
 * 设计原则：
 *   - 不再追求"几乎接近灰白"的极低饱和度（那种在 TUI 里会坍塌成灰）
 *   - 每个 hue 主题都让主色调清晰可读：保持柔和但 RGB 三通道差至少 24+
 *   - 每种 hue 都提供 light（浅色，深色文字）和 dark（中深色，浅色文字）两套
 *
 * 一共 8 个 hue × 2 = 16 个 morandi 主题。
 */

import type { ColorScheme } from './index';

// ─────────────────────────────────────────────────────────────────
// 共享 status / 中性色（在两种亮度下都可读）
// ─────────────────────────────────────────────────────────────────

const STATUS_LIGHT = {
  success: '#5f8a6c',
  warning: '#b87a3a',
  error: '#b04a55',
  info: '#4d7896',
} as const;

const STATUS_DARK = {
  success: '#a8c89a',
  warning: '#e8c878',
  error: '#e89898',
  info: '#9ac0d8',
} as const;

// ─────────────────────────────────────────────────────────────────
// 工厂函数：从核心色推导整套 ColorScheme
// ─────────────────────────────────────────────────────────────────

interface LightSpec {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHighlight: string;
  fgPrimary: string;
  fgSecondary: string;
  fgMuted: string;
  fgDim: string;
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary: string;
}

function makeLight(spec: LightSpec): ColorScheme {
  return {
    bg: {
      primary: spec.bgPrimary,
      secondary: spec.bgSecondary,
      tertiary: spec.bgTertiary,
      highlight: spec.bgHighlight,
    },
    fg: {
      primary: spec.fgPrimary,
      secondary: spec.fgSecondary,
      muted: spec.fgMuted,
      dim: spec.fgDim,
    },
    status: { ...STATUS_LIGHT },
    accent: {
      primary: spec.accentPrimary,
      secondary: spec.accentSecondary,
      tertiary: spec.accentTertiary,
    },
    border: {
      normal: spec.bgHighlight,
      active: spec.accentPrimary,
      muted: spec.bgTertiary,
    },
    wiki: {
      background: spec.bgSecondary,
      titleColor: STATUS_LIGHT.warning,
      labelColor: spec.accentSecondary,
      matchColor: STATUS_LIGHT.success,
      contentColor: spec.fgPrimary,
      tagColor: STATUS_LIGHT.info,
    },
  };
}

interface DarkSpec {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHighlight: string;
  fgPrimary: string;
  fgSecondary: string;
  fgMuted: string;
  fgDim: string;
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary: string;
}

function makeDark(spec: DarkSpec): ColorScheme {
  return {
    bg: {
      primary: spec.bgPrimary,
      secondary: spec.bgSecondary,
      tertiary: spec.bgTertiary,
      highlight: spec.bgHighlight,
    },
    fg: {
      primary: spec.fgPrimary,
      secondary: spec.fgSecondary,
      muted: spec.fgMuted,
      dim: spec.fgDim,
    },
    status: { ...STATUS_DARK },
    accent: {
      primary: spec.accentPrimary,
      secondary: spec.accentSecondary,
      tertiary: spec.accentTertiary,
    },
    border: {
      normal: spec.bgTertiary,
      active: spec.accentPrimary,
      muted: spec.bgSecondary,
    },
    wiki: {
      background: spec.bgSecondary,
      titleColor: STATUS_DARK.warning,
      labelColor: spec.accentSecondary,
      matchColor: STATUS_DARK.success,
      contentColor: spec.fgPrimary,
      tagColor: STATUS_DARK.info,
    },
  };
}

// ═════════════════════════════════════════════════════════════════
// 1. 樱花粉  Sakura Pink
// ═════════════════════════════════════════════════════════════════

export const sakuraPinkLight = makeLight({
  bgPrimary:   '#f5dde2',
  bgSecondary: '#ecc8d2',
  bgTertiary:  '#dfaebd',
  bgHighlight: '#cf94a5',
  fgPrimary:   '#3d2832',
  fgSecondary: '#5a3f4a',
  fgMuted:     '#8a6f7a',
  fgDim:       '#b89aa3',
  accentPrimary:   '#c45c75',
  accentSecondary: '#8a5fa8',
  accentTertiary:  '#5d8aa8',
});

export const sakuraPinkDark = makeDark({
  bgPrimary:   '#7a4a55',
  bgSecondary: '#6b3f49',
  bgTertiary:  '#5d353e',
  bgHighlight: '#4f2c34',
  fgPrimary:   '#f5e5e8',
  fgSecondary: '#dccbcf',
  fgMuted:     '#a89098',
  fgDim:       '#7a6770',
  accentPrimary:   '#f0a8b8',
  accentSecondary: '#d4a8e0',
  accentTertiary:  '#a8c8e0',
});

// ═════════════════════════════════════════════════════════════════
// 2. 雾霾青绿  Sage Green
// ═════════════════════════════════════════════════════════════════

export const sageGreenLight = makeLight({
  bgPrimary:   '#d8e8d6',
  bgSecondary: '#bedbb8',
  bgTertiary:  '#a3c89c',
  bgHighlight: '#86b07f',
  fgPrimary:   '#283d2a',
  fgSecondary: '#3f5a42',
  fgMuted:     '#6f8a72',
  fgDim:       '#9ab09c',
  accentPrimary:   '#6a9e72',
  accentSecondary: '#9e6a72',
  accentTertiary:  '#6a7a9e',
});

export const sageGreenDark = makeDark({
  bgPrimary:   '#4a6450',
  bgSecondary: '#3f5645',
  bgTertiary:  '#34483a',
  bgHighlight: '#2a3a30',
  fgPrimary:   '#e8f0e6',
  fgSecondary: '#cbd5c8',
  fgMuted:     '#92a08f',
  fgDim:       '#6d7a6b',
  accentPrimary:   '#a8d4a8',
  accentSecondary: '#d4a8b8',
  accentTertiary:  '#a8b8d4',
});

// ═════════════════════════════════════════════════════════════════
// 3. 薰衣草  Lavender
// ═════════════════════════════════════════════════════════════════

export const lavenderLight = makeLight({
  bgPrimary:   '#ddd5e8',
  bgSecondary: '#c8bcdb',
  bgTertiary:  '#b3a3cd',
  bgHighlight: '#9d8bbf',
  fgPrimary:   '#2d2640',
  fgSecondary: '#453d5d',
  fgMuted:     '#766b8e',
  fgDim:       '#a09abb',
  accentPrimary:   '#8a6fb0',
  accentSecondary: '#b06f8a',
  accentTertiary:  '#6fb0a5',
});

export const lavenderDark = makeDark({
  bgPrimary:   '#5a4f6e',
  bgSecondary: '#4d4360',
  bgTertiary:  '#3f3650',
  bgHighlight: '#322a40',
  fgPrimary:   '#ede8f5',
  fgSecondary: '#d2cce0',
  fgMuted:     '#9d96b0',
  fgDim:       '#73687f',
  accentPrimary:   '#c8b8e0',
  accentSecondary: '#e0b8c8',
  accentTertiary:  '#b8e0d4',
});

// ═════════════════════════════════════════════════════════════════
// 4. 雾霾蓝  Misty Blue
// ═════════════════════════════════════════════════════════════════

export const mistyBlueLight = makeLight({
  bgPrimary:   '#c8d6e8',
  bgSecondary: '#aec0db',
  bgTertiary:  '#92a9cd',
  bgHighlight: '#7591bf',
  fgPrimary:   '#1f2c40',
  fgSecondary: '#34445d',
  fgMuted:     '#65788e',
  fgDim:       '#94a4bb',
  accentPrimary:   '#5a7a9e',
  accentSecondary: '#9e7a5a',
  accentTertiary:  '#7a9e5a',
});

export const mistyBlueDark = makeDark({
  bgPrimary:   '#3d4f6a',
  bgSecondary: '#33435a',
  bgTertiary:  '#29374a',
  bgHighlight: '#1f2b3a',
  fgPrimary:   '#e6edf5',
  fgSecondary: '#c5cfdc',
  fgMuted:     '#8b96a8',
  fgDim:       '#646e7e',
  accentPrimary:   '#a8c0dc',
  accentSecondary: '#dcc0a8',
  accentTertiary:  '#c0dca8',
});

// ═════════════════════════════════════════════════════════════════
// 5. 焦糖奶茶  Milk Tea
// ═════════════════════════════════════════════════════════════════

export const milkTeaLight = makeLight({
  bgPrimary:   '#ecdcc4',
  bgSecondary: '#dcc4a3',
  bgTertiary:  '#c8a982',
  bgHighlight: '#b08c63',
  fgPrimary:   '#3d2e1c',
  fgSecondary: '#5a4630',
  fgMuted:     '#8a7458',
  fgDim:       '#b59f85',
  accentPrimary:   '#a8825a',
  accentSecondary: '#5a82a8',
  accentTertiary:  '#825aa8',
});

export const milkTeaDark = makeDark({
  bgPrimary:   '#6e5a40',
  bgSecondary: '#5d4c36',
  bgTertiary:  '#4d3f2c',
  bgHighlight: '#3d3122',
  fgPrimary:   '#f5ecdd',
  fgSecondary: '#dccfba',
  fgMuted:     '#a89678',
  fgDim:       '#7a6a52',
  accentPrimary:   '#d8b890',
  accentSecondary: '#90b8d8',
  accentTertiary:  '#b890d8',
});

// ═════════════════════════════════════════════════════════════════
// 6. 藕荷色  Lotus Pink
// ═════════════════════════════════════════════════════════════════

export const lotusPinkLight = makeLight({
  bgPrimary:   '#ecc8d6',
  bgSecondary: '#dcaec3',
  bgTertiary:  '#c891ad',
  bgHighlight: '#b27592',
  fgPrimary:   '#3d2030',
  fgSecondary: '#5a3548',
  fgMuted:     '#8a6378',
  fgDim:       '#b894a3',
  accentPrimary:   '#b6608e',
  accentSecondary: '#608eb6',
  accentTertiary:  '#8eb660',
});

export const lotusPinkDark = makeDark({
  bgPrimary:   '#6e3f55',
  bgSecondary: '#5d3548',
  bgTertiary:  '#4d2c3c',
  bgHighlight: '#3d2230',
  fgPrimary:   '#f5e0e8',
  fgSecondary: '#dcc5d0',
  fgMuted:     '#a88898',
  fgDim:       '#7a5e6e',
  accentPrimary:   '#e8a8c4',
  accentSecondary: '#a8c4e8',
  accentTertiary:  '#c4e8a8',
});

// ═════════════════════════════════════════════════════════════════
// 7. 抹茶绿  Matcha
// ═════════════════════════════════════════════════════════════════

export const matchaLight = makeLight({
  bgPrimary:   '#d4e3c4',
  bgSecondary: '#bcd1a3',
  bgTertiary:  '#a3bd82',
  bgHighlight: '#86a163',
  fgPrimary:   '#28381c',
  fgSecondary: '#3f5230',
  fgMuted:     '#6e8258',
  fgDim:       '#9aab85',
  accentPrimary:   '#7a9658',
  accentSecondary: '#96587a',
  accentTertiary:  '#587a96',
});

export const matchaDark = makeDark({
  bgPrimary:   '#4f6440',
  bgSecondary: '#425636',
  bgTertiary:  '#36482c',
  bgHighlight: '#2a3a22',
  fgPrimary:   '#ecf2e2',
  fgSecondary: '#cdd6c0',
  fgMuted:     '#94a085',
  fgDim:       '#6e7a62',
  accentPrimary:   '#b8d490',
  accentSecondary: '#d490b8',
  accentTertiary:  '#90b8d4',
});

// ═════════════════════════════════════════════════════════════════
// 8. 蜜桃橙  Peach
// ═════════════════════════════════════════════════════════════════

export const peachLight = makeLight({
  bgPrimary:   '#f4d6b8',
  bgSecondary: '#ecbe92',
  bgTertiary:  '#dfa672',
  bgHighlight: '#cd8c54',
  fgPrimary:   '#3d2614',
  fgSecondary: '#5a3c25',
  fgMuted:     '#8a6f54',
  fgDim:       '#b8997e',
  accentPrimary:   '#c8835a',
  accentSecondary: '#5ac883',
  accentTertiary:  '#835ac8',
});

export const peachDark = makeDark({
  bgPrimary:   '#7a553f',
  bgSecondary: '#684735',
  bgTertiary:  '#56392a',
  bgHighlight: '#442d20',
  fgPrimary:   '#f5e5d3',
  fgSecondary: '#dcc8b3',
  fgMuted:     '#a88f72',
  fgDim:       '#7a644f',
  accentPrimary:   '#e8b890',
  accentSecondary: '#90e8b8',
  accentTertiary:  '#b890e8',
});
