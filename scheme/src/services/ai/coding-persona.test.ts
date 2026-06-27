import { describe, expect, it } from 'bun:test';
import type { CodingPersona } from '../../data/protocol/evolution-types';
import { mergePersonaNaming } from './coding-persona';

const base: CodingPersona = {
  scores: [{ axis: '思维广度', value: 60, leftLabel: '聚焦', rightLabel: '发散' }],
  typeCode: 'DTRSNV',
  archetypeCode: 'PIONEER',
  cnName: '拓荒者',
  intro: '没有路？那就踩一条出来。',
  catchphrase: '往前，没退路。',
  devStyle: '敢闯无人区',
  rarity: 'rare',
  dna: '发散·试错·原创·探索·夜行·漂移',
  title: '拓荒者',
  tagline: '没有路？那就踩一条出来。',
  reading: '基于真实行为信号推导。',
  signatureNodeId: 's1:a',
};

describe('mergePersonaNaming', () => {
  it('overlays only the AI reading, keeping the fixed archetype name/scores', () => {
    const raw = JSON.stringify({ reading: '你偏爱在试错中逼近答案，迭代很快。' });
    const out = mergePersonaNaming(raw, base);
    expect(out).not.toBeNull();
    expect(out!.reading).toContain('试错');
    // archetype identity + deterministic scores come from the base, untouched
    expect(out!.title).toBe('拓荒者');
    expect(out!.archetypeCode).toBe('PIONEER');
    expect(out!.scores).toBe(base.scores);
    expect(out!.typeCode).toBe('DTRSNV');
    expect(out!.signatureNodeId).toBe('s1:a');
  });

  it('extracts the reading JSON from surrounding prose / fences', () => {
    const raw = '当然：\n```json\n{"reading":"你像个拓荒者，敢闯无人区。"}\n```';
    const out = mergePersonaNaming(raw, base);
    expect(out!.reading).toContain('拓荒者');
    expect(out!.title).toBe(base.title); // name still fixed
  });

  it('returns null when no usable reading is present', () => {
    expect(mergePersonaNaming('no json here', base)).toBeNull();
    expect(mergePersonaNaming(JSON.stringify({ title: 'ignored' }), base)).toBeNull();
  });
});
