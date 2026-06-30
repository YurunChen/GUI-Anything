import type { ReactNode } from 'react';

import { useTuiTheme } from '../theme';
import type { SemanticColors } from '../themes/semantic-map';
import { truncateFlowText } from '../../../utils/flow-text';
import { flowSpacing } from './flow-ui/flow-spacing';

export type ExportStatusTone = 'pending' | 'success' | 'failed';

export interface ExportStatusChrome {
  tone: ExportStatusTone;
  glyph: string;
  fg: string;
  borderColor: string;
}

interface ExportStatusThemeColors extends Pick<SemanticColors, 'activity' | 'success' | 'destructive' | 'tintMuted'> {}

const PENDING_STATUS_GLYPHS = ['…', '·', '…', '·'] as const;

export function resolveExportStatusChrome(
  status: string,
  colors: ExportStatusThemeColors,
  motionFrame = 0,
): ExportStatusChrome {
  const normalized = status.trim().toLowerCase();
  if (normalized.startsWith('⚠') || normalized.includes('failed') || normalized.includes('失败')) {
    return { tone: 'failed', glyph: '!', fg: colors.destructive, borderColor: colors.destructive };
  }
  if (normalized.startsWith('✓') || normalized.includes('opened') || normalized.includes('已导出')) {
    return { tone: 'success', glyph: '✓', fg: colors.success, borderColor: colors.success };
  }
  return {
    tone: 'pending',
    glyph: resolveExportStatusPulseGlyph(motionFrame),
    fg: colors.activity,
    borderColor: resolveExportStatusBorderColor(motionFrame, colors.activity, colors.tintMuted),
  };
}

export function resolveExportStatusPulseGlyph(motionFrame: number): string {
  const index = Math.max(0, Math.floor(motionFrame)) % PENDING_STATUS_GLYPHS.length;
  return PENDING_STATUS_GLYPHS[index];
}

export function resolveExportStatusBorderColor(
  motionFrame: number,
  activeColor: string,
  restingColor: string,
): string {
  const frame = Math.floor(Math.max(0, motionFrame));
  return frame % 4 === 0 ? activeColor : restingColor;
}

export interface ExportStatusBarProps {
  status?: string;
  terminalWidth: number;
  motionFrame: number;
}

export function ExportStatusBar({ status, terminalWidth, motionFrame }: ExportStatusBarProps): ReactNode {
  const text = status?.trim();
  if (!text) return null;

  const theme = useTuiTheme();
  const chrome = resolveExportStatusChrome(text, theme.semantic, motionFrame);
  const contentWidth = Math.max(24, terminalWidth - flowSpacing.chromePadX * 2);
  const statusText = truncateFlowText(text, Math.max(8, contentWidth - 11));

  return (
    <box
      style={{
        width: '100%',
        flexShrink: 0,
        flexDirection: 'row',
        backgroundColor: theme.semantic.fill.elevated,
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 0,
        paddingBottom: 0,
        border: ['top'],
        borderColor: chrome.borderColor,
        borderStyle: 'single',
      }}
    >
      <text wrapMode="none">
        <span fg={chrome.fg}>{`HTML ${chrome.glyph} `}</span>
        <span fg={theme.semantic.label.primary}>{statusText}</span>
      </text>
    </box>
  );
}
