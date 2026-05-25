/**
 * Apple System — balanced dark/light palettes with visible but calm accent bar.
 */

import type { ColorScheme } from './index';

const WIKI_DARK = {
  background: '#1A1A1C',
  titleColor: '#EDEDF0',
  labelColor: '#727276',
  matchColor: '#727276',
  contentColor: '#A0A0A5',
  tagColor: '#727276',
} as const;

const WIKI_LIGHT = {
  background: '#FFFFFF',
  titleColor: '#1C1C1E',
  labelColor: '#636366',
  matchColor: '#636366',
  contentColor: '#48484A',
  tagColor: '#636366',
} as const;

/** Dark — charcoal canvas, clear hierarchy, accent bar readable in terminal */
export const appleSystemDark: ColorScheme = {
  bg: {
    primary: '#0F0F11',
    secondary: '#1A1A1C',
    tertiary: '#222224',
    highlight: '#2C2C2E',
  },
  fg: {
    primary: '#EDEDF0',
    secondary: '#A0A0A5',
    muted: '#727276',
    dim: '#48484A',
  },
  status: {
    success: '#6FAF82',
    warning: '#B89A62',
    error: '#B8726C',
    info: '#6FA8D7',
  },
  accent: {
    primary: '#6FA8D7',
    secondary: '#8E8AA8',
    tertiary: '#3D5A73',
  },
  border: {
    normal: '#333336',
    active: '#6FA8D7',
    muted: '#252528',
  },
  wiki: { ...WIKI_DARK },
};

export const appleSystemLight: ColorScheme = {
  bg: {
    primary: '#F2F2F5',
    secondary: '#FFFFFF',
    tertiary: '#F7F7FA',
    highlight: '#E8E8ED',
  },
  fg: {
    primary: '#1C1C1E',
    secondary: '#48484A',
    muted: '#636366',
    dim: '#AEAEB2',
  },
  status: {
    success: '#4E9464',
    warning: '#A88440',
    error: '#A85E58',
    info: '#4A85AD',
  },
  accent: {
    primary: '#4A85AD',
    secondary: '#6E6A88',
    tertiary: '#6E8FA8',
  },
  border: {
    normal: '#C8C8CC',
    active: '#4A85AD',
    muted: '#E4E4E8',
  },
  wiki: { ...WIKI_LIGHT },
};
