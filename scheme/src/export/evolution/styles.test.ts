import { describe, expect, it } from 'bun:test';
import { getEvolutionStyles } from './styles';

describe('getEvolutionStyles', () => {
  it('uses web semantic tokens for export surfaces and affordances', () => {
    const css = getEvolutionStyles();

    expect(css).toContain('var(--page-background');
    expect(css).toContain('var(--surface-background');
    expect(css).toContain('var(--surface-muted');
    expect(css).toContain('var(--icon-background');
    expect(css).toContain('var(--scrollbar-thumb');
  });

  it('keeps the left rail visible instead of clipping active markers', () => {
    const css = getEvolutionStyles();

    expect(css).toContain('overflow: visible;');
    expect(css).not.toContain('overflow-y: auto;');
  });
});
