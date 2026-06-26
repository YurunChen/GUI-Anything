/**
 * Theme Configuration - 持久化主题设置
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ThemeName } from './index';
import { resolveThemeName } from './index';

const CONFIG_DIR = path.join(os.homedir(), '.flow-observer');
const THEME_CONFIG_FILE = path.join(CONFIG_DIR, 'theme.json');

export interface ThemeConfig {
  currentTheme: ThemeName;
  lastUpdated: number;
}

export function loadThemeConfig(): ThemeConfig | null {
  try {
    if (!fs.existsSync(THEME_CONFIG_FILE)) {
      return null;
    }
    const data = fs.readFileSync(THEME_CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveThemeConfig(themeName: ThemeName): void {
  try {
    // 确保目录存在
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const config: ThemeConfig = {
      currentTheme: themeName,
      lastUpdated: Date.now(),
    };

    fs.writeFileSync(THEME_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save theme config:', error);
  }
}

export function getDefaultTheme(): ThemeName {
  // 优先级: 环境变量 > 配置文件 > 默认值
  const envTheme = process.env.FLOW_THEME;
  if (envTheme) {
    const resolved = resolveThemeName(envTheme);
    if (resolved) return resolved;
  }

  const config = loadThemeConfig();
  if (config) {
    const resolved = resolveThemeName(config.currentTheme);
    if (resolved) return resolved;
  }

  return 'transparent';
}
