import { describe, expect, it } from 'bun:test';
import {
  contentTextColumns,
  flowContentColumns,
  lineDisplayWidth,
  wrapCharLines,
  wrapFlowText,
} from './summary-layout';

describe('wrapFlowText', () => {
  it('keeps English words intact when possible', () => {
    const lines = wrapFlowText('scheme directory and activity-tree module', 24);
    expect(lines.join(' ')).toContain('scheme');
    expect(lines.join(' ')).toContain('activity-tree');
    for (const line of lines) {
      expect(lineDisplayWidth(line)).toBeLessThanOrEqual(24);
    }
  });

  it('keeps long identifiers intact before char wrap fallback', () => {
    const lines = wrapFlowText('project-overview-flow-observer-dual-process', 18);
    expect(lines.join('')).toBe('project-overview-flow-observer-dual-process');
    for (const line of lines) {
      expect(lineDisplayWidth(line)).toBeLessThanOrEqual(18);
    }
  });

  it('wraps CJK without spurious blank lines', () => {
    const text = '用户请我看 POCKETFLOW_INTEGRATION_PLAN.md 方案可行性。';
    const lines = wrapFlowText(text, 20);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.at(-1)).not.toBe('');
    for (const line of lines) {
      expect(lineDisplayWidth(line)).toBeLessThanOrEqual(20);
    }
  });

  it('char-breaks long tokens without spaces (pure CJK run)', () => {
    const text = '这是一段没有空格的中文摘要内容需要按显示列硬切';
    const lines = wrapFlowText(text, 12);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(text);
    for (const line of lines) {
      expect(lineDisplayWidth(line)).toBeLessThanOrEqual(12);
    }
  });
});

describe('contentTextColumns', () => {
  it('applies preset reserves', () => {
    expect(contentTextColumns(80, 'summary-panel')).toBe(72);
    expect(contentTextColumns(52, 'wiki-card')).toBe(40);
    expect(contentTextColumns(24, 'timeline-body')).toBe(12);
  });
});

describe('flowContentColumns', () => {
  it('subtracts rail and label gutters', () => {
    const cols = flowContentColumns({
      availableWidth: 52,
      leftGutter: '│ ',
      labelPrefix: '  summary: ',
    });
    expect(cols).toBeLessThan(52);
    expect(cols).toBeGreaterThanOrEqual(12);
  });
});

describe('wrapCharLines', () => {
  it('breaks only when needed at character boundaries', () => {
    const lines = wrapCharLines('abcdef', 3);
    expect(lines).toEqual(['abc', 'def']);
  });
});
