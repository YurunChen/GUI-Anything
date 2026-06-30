import { describe, expect, it } from 'bun:test';
import type { CodingPersona } from '../../../data/protocol/evolution-types';
import { localizedText } from '../../../constants/observer-locale';
import { buildPersonalityStripInfo } from './personality-strip-view';

function persona(partial: Partial<CodingPersona> = {}): CodingPersona {
  return {
    scores: [],
    typeCode: 'FPOSEK',
    name: localizedText('Architecture Smith', '架构匠'),
    intro: localizedText('Draws the blueprint before placing the first brick.', '先把蓝图画完，再动第一砖。'),
    reading: localizedText('AI only adds the reading.', 'AI 只补充解读，不改判定字段。'),
    archetypeCode: 'ARCH',
    catchphrase: localizedText('Blueprint first.', '蓝图先行。'),
    devStyle: localizedText('Plan-first builder', '规划先行'),
    dna: localizedText('Focused · planned', '聚焦·规划'),
    rarity: 'epic',
    ...partial,
  };
}

describe('buildPersonalityStripInfo', () => {
  it('renders the shared CodingPersona protocol shape without internal codes', () => {
    const info = buildPersonalityStripInfo(persona());

    expect(info?.name).toBe('架构匠');
    expect(info?.intro).toBe('先把蓝图画完，再动第一砖。');
    expect(info?.rarity).toBe('epic');
    expect(JSON.stringify(info)).not.toContain('ARCH');
    expect(JSON.stringify(info)).not.toContain('FPOSEK');
  });

  it('uses English display fields when the observer locale is English', () => {
    const info = buildPersonalityStripInfo(persona(), 'en');

    expect(info?.name).toBe('Architecture Smith');
    expect(info?.intro).toBe('Draws the blueprint before placing the first brick.');
    expect(info?.catchphrase).toBe('Blueprint first.');
    expect(info?.devStyle).toBe('Plan-first builder');
  });

  it('returns null when no user-visible name exists', () => {
    expect(buildPersonalityStripInfo(persona({
      archetypeCode: undefined,
      name: localizedText('', ''),
    }))).toBeNull();
  });
});
