import { describe, expect, it } from 'bun:test';
import {
  lineDisplayWidth,
  summaryTextColumns,
  summaryTextareaHeight,
  wrapDisplayLines,
} from './flow/summary-layout';

describe('summary text wrapping', () => {
  it('counts CJK characters as double-width', () => {
    expect(lineDisplayWidth('abc')).toBe(3);
    expect(lineDisplayWidth('方案')).toBe(4);
    expect(lineDisplayWidth('A方案')).toBe(5);
  });

  it('wraps text without adding safety blank lines', () => {
    const text = '用户请我看 POCKETFLOW_INTEGRATION_PLAN.md 方案可行性。';
    const lines = wrapDisplayLines(text, 20);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.at(-1)).not.toBe('');
    expect(summaryTextareaHeight(text, 28)).toBe(lines.length);
    for (const line of lines) {
      expect(lineDisplayWidth(line)).toBeLessThanOrEqual(20);
    }
  });

  it('reserves layout columns before wrapping summary text', () => {
    expect(summaryTextColumns(80)).toBe(72);
    expect(summaryTextColumns(24)).toBe(20);
  });
});
