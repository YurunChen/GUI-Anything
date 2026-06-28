import { describe, expect, it } from 'bun:test';
import type { CodingPersona } from '../../../data/protocol/evolution-types';
import { buildPersonalityStripInfo } from './personality-strip-view';

function persona(partial: Partial<CodingPersona> = {}): CodingPersona {
  return {
    scores: [],
    typeCode: 'FPOSEK',
    title: 'AI 标题',
    tagline: 'AI tagline',
    reading: 'AI 只补充解读，不改判定字段。',
    archetypeCode: 'ARCH',
    cnName: '架构匠',
    intro: '先把蓝图画完，再动第一砖。',
    catchphrase: '蓝图先行。',
    devStyle: '规划先行',
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

  it('falls back to catchphrase when intro is missing', () => {
    const info = buildPersonalityStripInfo(persona({ intro: undefined }));

    expect(info?.name).toBe('架构匠');
    expect(info?.intro).toBeUndefined();
    expect(info?.catchphrase).toBe('蓝图先行。');
  });

  it('returns null when no user-visible name exists', () => {
    expect(buildPersonalityStripInfo(persona({
      archetypeCode: undefined,
      cnName: undefined,
      title: '',
    }))).toBeNull();
  });
});
