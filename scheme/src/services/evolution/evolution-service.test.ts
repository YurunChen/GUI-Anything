import { describe, expect, it } from 'bun:test';

import type { ProjectEvolutionRaw } from '../../data/protocol/evolution-types';
import { buildEvolutionExport, type EraSynthesizer } from './evolution-service';

function raw(): ProjectEvolutionRaw {
  return {
    workspaceRoot: '/proj',
    sessions: [
      {
        sessionId: 's1',
        workspaceRoot: '/proj',
        startedAt: 10,
        updatedAt: 40,
        title: '会话一',
        revisions: [
          { explorationId: 'e1', at: 10, intentKey: 'observer', nodeTitle: '搭建观察器', delta: 'pivot', note: '双栏时间线' },
          { explorationId: 'e2', at: 20, intentKey: 'observer', nodeTitle: '加实时刷新', delta: 'refine', note: '文件监听' },
          { explorationId: 'e3', at: 30, intentKey: 'wiki', nodeTitle: '知识沉淀', delta: 'pivot', note: '写入 wiki' },
        ],
        summaries: { e1: '观察器摘要' },
      },
    ],
  };
}

describe('buildEvolutionExport', () => {
  it('folds non-pivot revisions under the preceding pivot milestone', async () => {
    const out = await buildEvolutionExport({ raw: raw() });
    expect(out.project.nodes.map((n) => n.title)).toEqual(['搭建观察器', '知识沉淀']);
    expect(out.project.nodes[0].children.map((c) => c.title)).toEqual(['加实时刷新']);
  });

  it('uses rule eras (aiUsed=false) when no synthesizer given', async () => {
    const out = await buildEvolutionExport({ raw: raw() });
    expect(out.aiUsed).toBe(false);
    // two distinct intent keys → two rule eras
    expect(out.project.eras.length).toBe(2);
    // every node assigned to a real era
    const eraIds = new Set(out.project.eras.map((e) => e.id));
    for (const node of out.project.nodes) expect(eraIds.has(node.eraId)).toBe(true);
  });

  it('uses AI eras (aiUsed=true) when synthesizer returns valid eras', async () => {
    const synth: EraSynthesizer = async (nodes) => [
      { id: 'x', order: 0, title: '统一纪元', abstract: 'all', sceneAdds: ['a'], nodeIds: nodes.map((n) => n.id) },
    ];
    const out = await buildEvolutionExport({ raw: raw(), eraSynthesizer: synth });
    expect(out.aiUsed).toBe(true);
    expect(out.project.eras.length).toBe(1);
    expect(out.project.eras[0].title).toBe('统一纪元');
  });

  it('falls back to rule eras when synthesizer returns null', async () => {
    const synth: EraSynthesizer = async () => null;
    const out = await buildEvolutionExport({ raw: raw(), eraSynthesizer: synth });
    expect(out.aiUsed).toBe(false);
    expect(out.project.eras.length).toBe(2);
  });

  it('falls back to rule eras when synthesizer throws', async () => {
    const synth: EraSynthesizer = async () => {
      throw new Error('boom');
    };
    const out = await buildEvolutionExport({ raw: raw(), eraSynthesizer: synth });
    expect(out.aiUsed).toBe(false);
    expect(out.project.eras.length).toBe(2);
  });

  it('session drill-downs always use rule eras', async () => {
    const synth: EraSynthesizer = async (nodes) => [
      { id: 'x', order: 0, title: 'one', abstract: '', sceneAdds: [], nodeIds: nodes.map((n) => n.id) },
    ];
    const out = await buildEvolutionExport({ raw: raw(), eraSynthesizer: synth });
    expect(out.sessions).toHaveLength(1);
    expect(out.sessions[0].eras.length).toBe(2);
  });
});
