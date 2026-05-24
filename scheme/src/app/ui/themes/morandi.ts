/**
 * 莫兰迪色系主题 - 高级优雅的配色方案
 * Morandi Color Schemes - Elegant and sophisticated
 */

import type { ColorScheme } from './index';

// 🌸 樱花粉 - Sakura Pink
// 温柔的粉色调，优雅浪漫
export const sakuraPink: ColorScheme = {
  bg: {
    primary: '#ffe5ec',      // 樱花粉白
    secondary: '#ffc2d4',    // 明亮粉
    tertiary: '#ffb3c6',     // 深樱花粉
    highlight: '#ff8fab',    // 粉红
  },
  fg: {
    primary: '#4a1e2c',      // 深褐紫
    secondary: '#6b2d43',    // 紫褐
    muted: '#9e5770',        // 玫瑰棕
    dim: '#c98ca3',          // 淡粉
  },
  status: {
    success: '#6ec89a',      // 薄荷绿
    warning: '#ffb66c',      // 橙黄
    error: '#ff6b9d',        // 粉红
    info: '#7eb3d6',         // 天蓝
  },
  accent: {
    primary: '#fb6f92',      // 玫瑰红
    secondary: '#c77dff',    // 紫罗兰
    tertiary: '#89c9ff',     // 天空蓝
  },
  border: {
    normal: '#ff8fab',
    active: '#fb6f92',
    muted: '#ffb3c6',
  },
  wiki: {
    background: '#ffc2d4',
    titleColor: '#ff6b35',
    labelColor: '#c77dff',
    matchColor: '#6ec89a',
    contentColor: '#4a1e2c',
    tagColor: '#7eb3d6',
  },
};

// 🌿 薄荷绿 - Mint Green
// 清新活力的绿色调
export const sageGreen: ColorScheme = {
  bg: {
    primary: '#e0f9f4',      // 薄荷白
    secondary: '#b8f3e5',    // 明亮薄荷
    tertiary: '#8eedd4',     // 深薄荷
    highlight: '#5edbb8',    // 青绿
  },
  fg: {
    primary: '#1a4d3e',      // 深绿
    secondary: '#2d6b57',    // 墨绿
    muted: '#4a9578',        // 青绿
    dim: '#7bc4a8',          // 淡绿
  },
  status: {
    success: '#5edbb8',      // 薄荷绿
    warning: '#ffb66c',      // 橙黄
    error: '#ff8a9a',        // 粉红
    info: '#6eb5ff',         // 天蓝
  },
  accent: {
    primary: '#4ecdc4',      // 青蓝
    secondary: '#95e1d3',    // 淡青
    tertiary: '#6bb6ff',     // 蓝色
  },
  border: {
    normal: '#5edbb8',
    active: '#4ecdc4',
    muted: '#8eedd4',
  },
  wiki: {
    background: '#b8f3e5',
    titleColor: '#ff9966',
    labelColor: '#9d84ff',
    matchColor: '#5edbb8',
    contentColor: '#1a4d3e',
    tagColor: '#6bb6ff',
  },
};

// 🎨 薰衣草紫 - Lavender
// 优雅的紫色调，神秘浪漫
export const lavender: ColorScheme = {
  bg: {
    primary: '#f0e6ff',      // 薰衣草白
    secondary: '#d4b3ff',    // 明亮紫
    tertiary: '#c299ff',     // 深紫
    highlight: '#a066ff',    // 紫罗兰
  },
  fg: {
    primary: '#3d1f5c',      // 深紫
    secondary: '#5a2d7a',    // 紫色
    muted: '#8257a8',        // 淡紫
    dim: '#b38dd6',          // 浅紫
  },
  status: {
    success: '#6ec89a',      // 薄荷绿
    warning: '#ffb86c',      // 橙黄
    error: '#ff79c6',        // 粉紫
    info: '#8be9fd',         // 青蓝
  },
  accent: {
    primary: '#bd93f9',      // 紫色
    secondary: '#ff79c6',    // 粉紫
    tertiary: '#8be9fd',     // 青色
  },
  border: {
    normal: '#a066ff',
    active: '#bd93f9',
    muted: '#c299ff',
  },
  wiki: {
    background: '#d4b3ff',
    titleColor: '#ffb86c',
    labelColor: '#ff79c6',
    matchColor: '#6ec89a',
    contentColor: '#3d1f5c',
    tagColor: '#8be9fd',
  },
};

// 🌊 雾霾蓝 - Misty Blue
// 沉静优雅的蓝色调
export const mistyBlue: ColorScheme = {
  bg: {
    primary: '#e8ecf0',      // 淡蓝灰
    secondary: '#dfe5e9',    // 雾蓝白
    tertiary: '#d4dce1',     // 深蓝灰
    highlight: '#c4ced4',    // 蓝褐
  },
  fg: {
    primary: '#4a5258',      // 深蓝棕
    secondary: '#5d656c',    // 蓝灰
    muted: '#7a8288',        // 浅蓝灰
    dim: '#a4aeb4',          // 淡蓝
  },
  status: {
    success: '#88b3a6',      // 莫兰迪绿
    warning: '#c4a47a',      // 暖米棕
    error: '#c88a8a',        // 柔和红
    info: '#7a9fb4',         // 雾蓝
  },
  accent: {
    primary: '#a5b5c4',      // 淡蓝
    secondary: '#b5a5c4',    // 淡紫
    tertiary: '#b5c4a5',     // 淡绿
  },
  border: {
    normal: '#c4ced4',
    active: '#a5b5c4',
    muted: '#d4dce1',
  },
  wiki: {
    background: '#dfe5e9',
    titleColor: '#c4a47a',
    labelColor: '#b5a5c4',
    matchColor: '#88b3a6',
    contentColor: '#4a5258',
    tagColor: '#7a9fb4',
  },
};

// 🍂 奶茶棕 - Milk Tea
// 温暖舒适的米棕色调
export const milkTea: ColorScheme = {
  bg: {
    primary: '#ffeedd',      // 奶茶白
    secondary: '#ffcc99',    // 奶茶色
    tertiary: '#ffb366',     // 焦糖色
    highlight: '#ff9933',    // 橙棕
  },
  fg: {
    primary: '#4a3520',      // 深棕
    secondary: '#6b4e2d',    // 棕色
    muted: '#9e7548',        // 浅棕
    dim: '#c9a373',          // 淡棕
  },
  status: {
    success: '#6ec89a',      // 薄荷绿
    warning: '#ffaa55',      // 橙色
    error: '#ff6b9d',        // 粉红
    info: '#6eb5ff',         // 天蓝
  },
  accent: {
    primary: '#ff9966',      // 橙棕
    secondary: '#ffb380',    // 橙粉
    tertiary: '#6eb5ff',     // 天蓝
  },
  border: {
    normal: '#ff9933',
    active: '#ff9966',
    muted: '#ffb366',
  },
  wiki: {
    background: '#ffcc99',
    titleColor: '#ff7733',
    labelColor: '#c77dff',
    matchColor: '#6ec89a',
    contentColor: '#4a3520',
    tagColor: '#6eb5ff',
  },
};

// 🌸 藕粉色 - Lotus Pink
// 温柔细腻的粉色调
export const lotusPink: ColorScheme = {
  bg: {
    primary: '#f5e8eb',      // 藕粉白
    secondary: '#eddfe3',    // 淡粉
    tertiary: '#e3d4d9',     // 深粉灰
    highlight: '#d3c4c9',    // 粉褐
  },
  fg: {
    primary: '#5a4a4f',      // 深粉棕
    secondary: '#6d5d62',    // 粉灰
    muted: '#8a7a7f',        // 浅粉灰
    dim: '#b4a4a9',          // 淡粉
  },
  status: {
    success: '#88b3a1',      // 莫兰迪绿
    warning: '#d4a574',      // 暖橙
    error: '#d49090',        // 柔粉红
    info: '#8fa9c4',         // 雾蓝
  },
  accent: {
    primary: '#d4a5b5',      // 玫瑰粉
    secondary: '#b5a5c4',    // 淡紫
    tertiary: '#a5c4b5',     // 淡青
  },
  border: {
    normal: '#d3c4c9',
    active: '#d4a5b5',
    muted: '#e3d4d9',
  },
  wiki: {
    background: '#eddfe3',
    titleColor: '#d4a574',
    labelColor: '#b5a5c4',
    matchColor: '#88b3a1',
    contentColor: '#5a4a4f',
    tagColor: '#8fa9c4',
  },
};

// 🍵 抹茶绿 - Matcha
// 清新淡雅的抹茶色
export const matcha: ColorScheme = {
  bg: {
    primary: '#e8f5e9',      // 抹茶白
    secondary: '#c5e1a5',    // 抹茶绿
    tertiary: '#aed581',     // 深抹茶
    highlight: '#9ccc65',    // 青绿
  },
  fg: {
    primary: '#2e4a1f',      // 深绿
    secondary: '#4a6b3d',    // 墨绿
    muted: '#689f5b',        // 绿色
    dim: '#9ac88b',          // 淡绿
  },
  status: {
    success: '#81c784',      // 绿色
    warning: '#ffb74d',      // 橙黄
    error: '#ef5350',        // 红色
    info: '#4fc3f7',         // 蓝色
  },
  accent: {
    primary: '#66bb6a',      // 绿色
    secondary: '#81c784',    // 淡绿
    tertiary: '#4fc3f7',     // 蓝色
  },
  border: {
    normal: '#9ccc65',
    active: '#66bb6a',
    muted: '#aed581',
  },
  wiki: {
    background: '#c5e1a5',
    titleColor: '#fb8c00',
    labelColor: '#ab47bc',
    matchColor: '#81c784',
    contentColor: '#2e4a1f',
    tagColor: '#4fc3f7',
  },
};

// 🌅 蜜桃橙 - Peach
// 温暖甜美的橙粉色调
export const peach: ColorScheme = {
  bg: {
    primary: '#ffe5d9',      // 蜜桃白
    secondary: '#ffcdb2',    // 蜜桃色
    tertiary: '#ffb38a',     // 橙粉
    highlight: '#ff9663',    // 橙色
  },
  fg: {
    primary: '#4a2c1f',      // 深棕
    secondary: '#6b4433',    // 棕色
    muted: '#9e6b52',        // 浅棕
    dim: '#c99a7f',          // 淡橙
  },
  status: {
    success: '#6ec89a',      // 薄荷绿
    warning: '#ffaa66',      // 橙色
    error: '#ff6b9d',        // 粉红
    info: '#6eb5ff',         // 天蓝
  },
  accent: {
    primary: '#ff8855',      // 橙色
    secondary: '#ffaa77',    // 淡橙
    tertiary: '#6eb5ff',     // 天蓝
  },
  border: {
    normal: '#ff9663',
    active: '#ff8855',
    muted: '#ffb38a',
  },
  wiki: {
    background: '#ffcdb2',
    titleColor: '#ff6633',
    labelColor: '#c77dff',
    matchColor: '#6ec89a',
    contentColor: '#4a2c1f',
    tagColor: '#6eb5ff',
  },
};
