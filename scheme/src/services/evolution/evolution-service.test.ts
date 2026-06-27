import { describe, expect, it } from 'bun:test';

import type { ProjectEvolutionRaw, SessionEvolutionRaw } from '../../data/protocol/evolution-types';
import { AUTO_INFERRED_FLOWCHART_NOTE } from '../ai/intent-infer';
import { buildEvolutionExport, filterNoiseSessions, type EraSynthesizer } from './evolution-service';

function emptyRawSession(over: Partial<SessionEvolutionRaw>): SessionEvolutionRaw {
  return {
    sessionId: 'sx',
    workspaceRoot: '/proj',
    startedAt: 0,
    updatedAt: 0,
    title: 't',
    revisions: [],
    summaries: {},
    metricsByExp: {},
    retrievals: [],
    writes: [],
    ...over,
  };
}

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
        metricsByExp: {
          e1: { toolCount: 5, errorCount: 1, interrupted: false, tokens: 100, files: ['a.ts'], retrieval: true, write: false },
          e2: { toolCount: 3, errorCount: 0, interrupted: false, tokens: 50, files: ['b.ts'], retrieval: false, write: true },
          e3: { toolCount: 2, errorCount: 2, interrupted: false, tokens: 80, files: ['a.ts', 'c.ts'], retrieval: false, write: true },
        },
        retrievals: [
          { explorationId: 'e1', request: '查观察器', excerpt: '旧的观察器实现', tags: ['observer'], score: 0.9, type: 'context' },
        ],
        writes: [
          { explorationId: 'e2', targetId: 'k-observer', targetPath: 'knowledge/k-observer.md', status: 'saved' },
          { explorationId: 'e3', targetId: 'k-wiki', targetPath: 'knowledge/k-wiki.md', status: 'updated' },
        ],
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

  it('aggregates node / era / project metrics from raw per-exploration signals', async () => {
    const out = await buildEvolutionExport({ raw: raw() });
    // Node 0 (pivot e1 + folded child e2): toolCount 5+3, errorCount 1+0, tokens 100+50.
    const n0 = out.project.nodes[0];
    expect(n0.metrics?.toolCount).toBe(8);
    expect(n0.metrics?.errorCount).toBe(1);
    expect(n0.metrics?.tokens).toBe(150);
    expect(n0.metrics?.retrievals).toBe(1);
    expect(n0.metrics?.writes).toBe(1);
    expect(n0.metrics?.files?.sort()).toEqual(['a.ts', 'b.ts']);
    // elapsedMs = next milestone at (30) − this at (10).
    expect(n0.metrics?.elapsedMs).toBe(20);
    // Node 1 (pivot e3, last → updatedAt 40): elapsed 40−30.
    const n1 = out.project.nodes[1];
    expect(n1.metrics?.toolCount).toBe(2);
    expect(n1.metrics?.elapsedMs).toBe(10);
    // Project scope: Σ tools 10, errors 3, tokens 230, deduped files.
    expect(out.project.metrics.toolCount).toBe(10);
    expect(out.project.metrics.errorCount).toBe(3);
    expect(out.project.metrics.tokens).toBe(230);
    expect(out.project.metrics.files?.sort()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('builds project knowledge flow, mapping exps to milestones and sorting inflow by score', async () => {
    const out = await buildEvolutionExport({ raw: raw() });
    expect(out.knowledge).toBeDefined();
    // one retrieval (e1) → maps to the first milestone node
    expect(out.knowledge!.inflow).toHaveLength(1);
    expect(out.knowledge!.inflow[0].nodeId).toBe('s1:e1');
    expect(out.knowledge!.inflow[0].nodeTitle).toBe('搭建观察器');
    // two writes: e2 folds under milestone 0 (s1:e1), e3 is its own pivot (s1:e3)
    const targets = out.knowledge!.outflow.map((w) => w.targetId).sort();
    expect(targets).toEqual(['k-observer', 'k-wiki']);
    const e2write = out.knowledge!.outflow.find((w) => w.targetId === 'k-observer');
    const e3write = out.knowledge!.outflow.find((w) => w.targetId === 'k-wiki');
    expect(e2write?.nodeId).toBe('s1:e1');
    expect(e3write?.nodeId).toBe('s1:e3');
  });

  it('filters auto-inferred / idle revisions and drops fully-trivial sessions', () => {
    const input: ProjectEvolutionRaw = {
      workspaceRoot: '/proj',
      sessions: [
        // real session: kept whole
        emptyRawSession({
          sessionId: 'real',
          revisions: [
            { explorationId: 'a', at: 1, intentKey: 'explore', nodeTitle: '了解架构', delta: 'pivot', note: '真实探索' },
            { explorationId: 'b', at: 2, intentKey: 'explore', nodeTitle: '下钻 HTML 回放', delta: 'refine', note: '下钻子系统' },
          ],
        }),
        // trivial intro session: single auto-inferred node → dropped
        emptyRawSession({
          sessionId: 'intro',
          revisions: [
            { explorationId: 'c', at: 3, intentKey: 'project_design', nodeTitle: '介绍一下这个项目', delta: 'pivot', note: AUTO_INFERRED_FLOWCHART_NOTE },
          ],
        }),
        // greeting + auto-inferred: both noise → dropped
        emptyRawSession({
          sessionId: 'greet',
          revisions: [
            { explorationId: 'd', at: 4, intentKey: 'greeting', nodeTitle: '待具体任务', delta: 'idle', note: '' },
            { explorationId: 'e', at: 5, intentKey: 'project_design', nodeTitle: '介绍项目', delta: 'pivot', note: AUTO_INFERRED_FLOWCHART_NOTE },
          ],
        }),
      ],
    };
    const out = filterNoiseSessions(input);
    expect(out.sessions.map((s) => s.sessionId)).toEqual(['real']);
    expect(out.sessions[0].revisions).toHaveLength(2);
  });

  it('keeps a session whose first surviving revision is a refine (becomes lead milestone)', async () => {
    const input: ProjectEvolutionRaw = {
      workspaceRoot: '/proj',
      sessions: [
        emptyRawSession({
          sessionId: 's1',
          updatedAt: 30,
          revisions: [
            { explorationId: 'idle', at: 1, intentKey: 'greeting', nodeTitle: '待具体任务', delta: 'idle', note: '' },
            { explorationId: 'r1', at: 2, intentKey: 'explore', nodeTitle: '真实里程碑', delta: 'refine', note: '有意义' },
          ],
        }),
      ],
    };
    const out = await buildEvolutionExport({ raw: input });
    expect(out.project.nodes.map((n) => n.title)).toEqual(['真实里程碑']);
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
