import { describe, expect, it } from 'bun:test';
import type { CodingPersona } from '../../data/protocol/evolution-types';
import { mergePersonaNaming } from './coding-persona';

const base: CodingPersona = {
  scores: [{ axis: '思维广度', value: 60, leftLabel: '聚焦', rightLabel: '发散' }],
  typeCode: 'DTRS',
  title: '规则型开发者',
  tagline: '代号 DTRS',
  reading: '基于真实行为信号推导。',
  signatureNodeId: 's1:a',
};

describe('mergePersonaNaming', () => {
  it('overlays the AI naming while keeping deterministic scores', () => {
    const raw = JSON.stringify({
      title: '快速试错的拓荒者',
      tagline: '错了就改，改了再跑',
      reading: '你偏爱在试错中逼近答案，迭代很快。',
    });
    const out = mergePersonaNaming(raw, base);
    expect(out).not.toBeNull();
    expect(out!.title).toBe('快速试错的拓荒者');
    expect(out!.tagline).toBe('错了就改，改了再跑');
    expect(out!.reading).toContain('试错');
    // scores / typeCode / signature come from the deterministic base
    expect(out!.scores).toBe(base.scores);
    expect(out!.typeCode).toBe('DTRS');
    expect(out!.signatureNodeId).toBe('s1:a');
  });

  it('extracts JSON from surrounding prose / fences', () => {
    const raw = '当然：\n```json\n{"title":"精雕细琢的架构匠"}\n```';
    const out = mergePersonaNaming(raw, base);
    expect(out!.title).toBe('精雕细琢的架构匠');
    // missing fields fall back to base
    expect(out!.tagline).toBe(base.tagline);
  });

  it('returns null when nothing usable is present', () => {
    expect(mergePersonaNaming('no json here', base)).toBeNull();
    expect(mergePersonaNaming(JSON.stringify({ tagline: 'only tagline' }), base)).toBeNull();
  });
});
