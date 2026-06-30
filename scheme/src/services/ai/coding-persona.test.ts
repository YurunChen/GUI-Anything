import { describe, expect, it } from 'bun:test';
import type { CodingPersona } from '../../data/protocol/evolution-types';
import { localizedText, pickLocalizedText } from '../../constants/observer-locale';
import { mergePersonaNaming } from './coding-persona';

const base: CodingPersona = {
  scores: [{
    axis: localizedText('Thinking breadth', '思维广度'),
    value: 60,
    leftLabel: localizedText('Focused', '聚焦'),
    rightLabel: localizedText('Divergent', '发散'),
  }],
  typeCode: 'DTRSNV',
  archetypeCode: 'PIONEER',
  name: localizedText('Path Pioneer', '拓荒者'),
  intro: localizedText('No path? Makes one.', '没有路？那就踩一条出来。'),
  catchphrase: localizedText('Forward. No retreat.', '往前，没退路。'),
  devStyle: localizedText('Explores unknown ground', '敢闯无人区'),
  rarity: 'rare',
  dna: localizedText('Divergent · tinkering', '发散·试错'),
  reading: localizedText('Inferred from real signals.', '基于真实行为信号推导。'),
  signatureNodeId: 's1:a',
};

describe('mergePersonaNaming', () => {
  it('overlays only the AI reading, keeping the fixed archetype name/scores', () => {
    const raw = JSON.stringify({ reading: localizedText('You iterate quickly through trials.', '你偏爱在试错中逼近答案，迭代很快。') });
    const out = mergePersonaNaming(raw, base);
    expect(out).not.toBeNull();
    expect(pickLocalizedText(out!.reading, 'zh-Hans')).toContain('试错');
    expect(pickLocalizedText(out!.reading, 'en')).toContain('iterate');
    // archetype identity + deterministic scores come from the base, untouched
    expect(out!.name).toEqual(base.name);
    expect(out!.archetypeCode).toBe('PIONEER');
    expect(out!.scores).toBe(base.scores);
    expect(out!.typeCode).toBe('DTRSNV');
    expect(out!.signatureNodeId).toBe('s1:a');
  });

  it('extracts the reading JSON from surrounding prose / fences', () => {
    const raw = '当然：\n```json\n{"reading":{"zh-Hans":"你像个拓荒者，敢闯无人区。","en":"You are a path pioneer."}}\n```';
    const out = mergePersonaNaming(raw, base);
    expect(pickLocalizedText(out!.reading, 'zh-Hans')).toContain('拓荒者');
    expect(out!.name).toEqual(base.name); // name still fixed
  });

  it('returns null when no usable reading is present', () => {
    expect(mergePersonaNaming('no json here', base)).toBeNull();
    expect(mergePersonaNaming(JSON.stringify({ title: 'ignored' }), base)).toBeNull();
  });
});
