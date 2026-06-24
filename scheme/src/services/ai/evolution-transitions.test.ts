import { describe, expect, it } from 'bun:test';
import { parseTransitionNarrative } from './evolution-transitions';

const IDS = ['s1:a', 's1:b', 's1:c'];

describe('parseTransitionNarrative', () => {
  it('keeps only edges with valid node ids and a non-empty why', () => {
    const raw = JSON.stringify({
      edges: [
        { fromNodeId: 's1:a', toNodeId: 's1:b', why: '报错太多，换思路', evidence: '连续报错' },
        { fromNodeId: 's1:b', toNodeId: 's1:c', why: '自然推进' },
        { fromNodeId: 's1:x', toNodeId: 's1:c', why: '无效 from id' }, // dropped
        { fromNodeId: 's1:a', toNodeId: 's1:c', why: '   ' },           // empty why dropped
      ],
    });
    const out = parseTransitionNarrative(raw, IDS);
    expect(out).not.toBeNull();
    expect(out!.edges).toHaveLength(2);
    expect(out!.edges[0]).toEqual({ fromNodeId: 's1:a', toNodeId: 's1:b', why: '报错太多，换思路', evidence: '连续报错' });
    expect(out!.edges[1].evidence).toBeUndefined();
  });

  it('extracts JSON even with surrounding prose / markdown fences', () => {
    const raw = '好的，这是结果：\n```json\n{"edges":[{"fromNodeId":"s1:a","toNodeId":"s1:b","why":"想通了"}]}\n```\n完毕';
    const out = parseTransitionNarrative(raw, IDS);
    expect(out!.edges).toHaveLength(1);
  });

  it('returns null when no edge survives or output is not JSON', () => {
    expect(parseTransitionNarrative('not json at all', IDS)).toBeNull();
    expect(parseTransitionNarrative(JSON.stringify({ edges: [] }), IDS)).toBeNull();
    expect(parseTransitionNarrative(JSON.stringify({ edges: [{ fromNodeId: 'x', toNodeId: 'y', why: 'w' }] }), IDS)).toBeNull();
  });
});
