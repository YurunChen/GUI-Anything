import { describe, expect, it } from 'bun:test';
import { renderBrailleCell } from './design-buddy-microcanvas';

describe('renderBrailleCell', () => {
  it('expands a braille contour cell into its 2x4 dot matrix', () => {
    expect(renderBrailleCell('⡠')).toEqual(['··', '··', '·●', '●·']);
    expect(renderBrailleCell('⢶')).toEqual(['··', '●●', '●●', '·●']);
  });

  it('marks non-braille characters as unavailable design cells', () => {
    expect(renderBrailleCell('?')).toEqual(['??', '??', '??', '??']);
  });
});
