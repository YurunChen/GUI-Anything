/**
 * Theme → CSS Variables 转换器
 * 将 ColorScheme 对象转换为 CSS Custom Properties
 */

import type { ColorScheme } from '../../app/ui/themes/index';
import { buildWebThemeTokens, webThemeTokensToCssVars } from './web-theme-tokens';

/** 将 ColorScheme 转换为 CSS 变量声明（分号分隔，便于前端解析） */
export function colorSchemeToCssVars(theme: ColorScheme): string {
  const webTokens = buildWebThemeTokens(theme);

  return [
    `--bg-primary: ${theme.bg.primary}`,
    `--bg-secondary: ${theme.bg.secondary}`,
    `--bg-tertiary: ${theme.bg.tertiary}`,
    `--bg-highlight: ${theme.bg.highlight}`,
    `--fg-primary: ${theme.fg.primary}`,
    `--fg-secondary: ${theme.fg.secondary}`,
    `--fg-muted: ${theme.fg.muted}`,
    `--fg-dim: ${theme.fg.dim}`,
    `--status-success: ${theme.status.success}`,
    `--status-warning: ${theme.status.warning}`,
    `--status-error: ${theme.status.error}`,
    `--status-info: ${theme.status.info}`,
    `--accent-primary: ${theme.accent.primary}`,
    `--accent-secondary: ${theme.accent.secondary}`,
    `--accent-tertiary: ${theme.accent.tertiary}`,
    `--border-normal: ${theme.border.normal}`,
    `--border-active: ${theme.border.active}`,
    `--border-muted: ${theme.border.muted}`,
    ...webThemeTokensToCssVars(webTokens),
  ].join('; ');
}

/** 生成所有主题的 CSS 数据对象（用于前端内嵌） */
export function allThemesToCssData(themes: Record<string, ColorScheme>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, scheme] of Object.entries(themes)) {
    result[name] = colorSchemeToCssVars(scheme);
  }
  return result;
}

/** 将主题数据转为可嵌入 HTML 的 JSON */
export function themesToEmbeddableJson(themes: Record<string, ColorScheme>): string {
  const data = allThemesToCssData(themes);
  return JSON.stringify(data);
}
