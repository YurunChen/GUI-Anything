import { describe, expect, it } from 'bun:test';
import type { EvolutionExport } from '../../data/protocol/evolution-types';
import { buildBaseDigest } from './digest-build';

function makeExport(over: Partial<EvolutionExport> = {}): EvolutionExport {
  const base: EvolutionExport = {
    version: '1.0',
    generatedAt: 0,
    aiUsed: false,
    project: {
      workspaceRoot: '/w',
      eras: [
        { id: 'era1', order: 0, title: '起步', abstract: '搭骨架', sceneAdds: [], nodeIds: ['s1:a'], metrics: { toolCount: 5, errorCount: 1, retrievals: 0, writes: 1, interrupted: 0, elapsedMs: 3_600_000 } },
        { id: 'era2', order: 1, title: '成型', abstract: '', sceneAdds: [], nodeIds: ['s1:b'], metrics: { toolCount: 3, errorCount: 0, retrievals: 1, writes: 1, interrupted: 0 } },
      ],
      nodes: [
        { id: 's1:a', eraId: 'era1', sessionId: 's1', title: '初始化', note: '', at: 1000, delta: 'pivot', children: [], metrics: { toolCount: 5, errorCount: 1, retrievals: 0, writes: 1, interrupted: 0 } },
        { id: 's1:b', eraId: 'era2', sessionId: 's1', title: '加功能', note: '', at: 2000, delta: 'continue', children: [], metrics: { toolCount: 3, errorCount: 0, retrievals: 1, writes: 1, interrupted: 0 } },
      ],
      metrics: { toolCount: 8, errorCount: 1, retrievals: 1, writes: 2, interrupted: 0, elapsedMs: 90_000_000, tokens: 12345, files: ['a.ts', 'b.ts'] },
    },
    sessions: [
      { sessionId: 's1', title: 's1', startedAt: 0, eras: [], nodes: [], metrics: { toolCount: 8, errorCount: 1, retrievals: 1, writes: 2, interrupted: 0 } },
    ],
  };
  return { ...base, ...over };
}

describe('buildBaseDigest', () => {
  it('always fills headline / chapters / outputs / learned, leaves nextSteps empty', () => {
    const d = buildBaseDigest(makeExport({
      knowledge: {
        inflow: [],
        outflow: [
          { sessionId: 's1', nodeId: 's1:b', nodeTitle: '加功能笔记', status: 'saved' },
          { sessionId: 's1', nodeId: 's1:b', nodeTitle: '加功能笔记', status: 'updated' }, // dup → deduped
        ],
      },
    }));
    expect(d.headline).toContain('阶段');
    expect(d.headline).toContain('成型'); // last era heads the thesis
    expect(d.chapters).toHaveLength(2);
    expect(d.chapters[0].era).toBe('起步');
    expect(d.chapters[0].line).toBe('搭骨架');
    expect(d.chapters[1].line).toBe('1 个里程碑'); // empty abstract → fallback
    expect(d.outputs.find((o) => o.label === '里程碑')!.value).toBe('2');
    expect(d.outputs.find((o) => o.label === 'Token')).toBeTruthy();
    expect(d.outputs.find((o) => o.label === '触碰文件')!.value).toBe('2');
    expect(d.learned).toEqual(['加功能笔记']);
    expect(d.nextSteps).toEqual([]);
  });

  it('reuses the P4 narrative for turningPoints when present', () => {
    const d = buildBaseDigest(makeExport({
      narrative: { edges: [{ fromNodeId: 's1:a', toNodeId: 's1:b', why: '骨架就绪后开始加功能' }] },
    }));
    expect(d.turningPoints).toHaveLength(1);
    expect(d.turningPoints[0].title).toBe('初始化 → 加功能');
    expect(d.turningPoints[0].why).toBe('骨架就绪后开始加功能');
  });

  it('omits turningPoints and learned cleanly with no narrative / knowledge', () => {
    const d = buildBaseDigest(makeExport());
    expect(d.turningPoints).toEqual([]);
    expect(d.learned).toEqual([]);
  });
});
