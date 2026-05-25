/**
 * Flow observer theme bootstrap — sync semantic colors on launch.
 */

import { applyTheme } from './theme';
import { getDefaultTheme } from './themes/theme-config';
import type { ThemeName } from './themes';

export function bootstrapFlowTheme(): ThemeName {
  const theme = getDefaultTheme();
  applyTheme(theme);
  return theme;
}
