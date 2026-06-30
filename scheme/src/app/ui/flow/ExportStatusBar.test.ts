import { describe, expect, it } from 'bun:test';

import { resolveExportStatusChrome } from './ExportStatusBar';

const colors = {
  activity: 'activity',
  success: 'success',
  destructive: 'destructive',
  tintMuted: 'tintMuted',
};

describe('resolveExportStatusChrome', () => {
  it('uses activity chrome for in-progress exports', () => {
    expect(resolveExportStatusChrome('⏳ Exporting…', colors)).toEqual({
      tone: 'pending',
      glyph: '…',
      fg: 'activity',
      borderColor: 'activity',
    });
  });

  it('pulses pending export chrome with the shared motion frame', () => {
    expect(resolveExportStatusChrome('⏳ Exporting…', colors, 0).glyph).toBe('…');
    expect(resolveExportStatusChrome('⏳ Exporting…', colors, 1).glyph).toBe('·');
    expect(resolveExportStatusChrome('⏳ Exporting…', colors, 1).borderColor).toBe('tintMuted');
    expect(resolveExportStatusChrome('⏳ Exporting…', colors, 4).borderColor).toBe('activity');
  });

  it('uses success chrome for completed exports', () => {
    expect(resolveExportStatusChrome('✓ Exported & opened', colors)).toEqual({
      tone: 'success',
      glyph: '✓',
      fg: 'success',
      borderColor: 'success',
    });
  });

  it('keeps terminal export states stable across motion frames', () => {
    expect(resolveExportStatusChrome('✓ Exported & opened', colors, 1)).toEqual(
      resolveExportStatusChrome('✓ Exported & opened', colors, 8),
    );
    expect(resolveExportStatusChrome('⚠ Export failed: disk full', colors, 1)).toEqual(
      resolveExportStatusChrome('⚠ Export failed: disk full', colors, 8),
    );
  });

  it('uses destructive chrome for failed exports in either locale', () => {
    expect(resolveExportStatusChrome('⚠ Export failed: disk full', colors).fg).toBe('destructive');
    expect(resolveExportStatusChrome('⚠ 导出失败: disk full', colors).tone).toBe('failed');
  });
});
