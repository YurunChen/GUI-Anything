import { describe, expect, it } from 'bun:test';
import type { Exploration, FlowchartHint } from '../../../../data/protocol/observer-protocol';
import { buildFlowGraphSnapshot } from './graph-builder';
import { applyGraphPatch } from '../../../../services/session/graph-patch-service';

describe('buildFlowGraphSnapshot', () => {
  it('builds deterministic nodes and edges', () => {
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 's1',
      explorations: [
        makeExploration('exp_2', 200, 'complete'),
        makeExploration('exp_1', 100, 'interrupted'),
        makeExploration('exp_3', 300, 'complete'),
      ],
      summaries: {
        exp_1: 'summary 1',
        exp_2: 'summary 2',
        exp_3: 'summary 3',
      },
      flowchartHints: {
        exp_1: hint('root_intent', 'Root intent', null, 'trunk', 'high'),
        exp_2: hint('parallel_a', 'Parallel A', 'root_intent', 'parallel', 'high'),
        exp_3: hint('parallel_b', 'Parallel B', 'root_intent', 'parallel', 'high'),
      },
      wikiPersistStatus: {
        exp_2: 'saved',
      },
    });

    expect(snapshot.nodes.map((n) => n.label)).toEqual(['Root intent', 'Parallel A', 'Parallel B']);
    expect(snapshot.edges.map((e) => e.kind)).toEqual(['fork_alternative', 'fork_alternative']);
    expect(snapshot.focusNodeId).toBe('s1:parallel_b_exp_3');
    expect(snapshot.nodes[1].metaBadges.wiki).toBe('saved');
  });

  it('uses fallback parent when declared parent is missing', () => {
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 's2',
      explorations: [
        makeExploration('exp_1', 100, 'complete'),
        makeExploration('exp_2', 200, 'complete'),
      ],
      summaries: {},
      flowchartHints: {
        exp_1: hint('root', 'Root', null, 'trunk', 'high'),
        exp_2: hint('child', 'Child', 'missing_parent', 'parallel', 'high'),
      },
    });

    expect(snapshot.edges).toHaveLength(1);
    expect(snapshot.edges[0].kind).toBe('fork_alternative');
  });

  it('filters low-importance and drop nodes', () => {
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 's3',
      explorations: [
        makeExploration('exp_1', 100, 'complete'),
        makeExploration('exp_2', 200, 'complete'),
        makeExploration('exp_3', 300, 'complete'),
      ],
      summaries: {},
      flowchartHints: {
        exp_1: hint('root', 'Root', null, 'trunk', 'high'),
        exp_2: hint('noise', 'Noise', 'root', 'parallel', 'low'),
        exp_3: {
          ...hint('drop_me', 'Drop me', 'root', 'parallel', 'high'),
          dropFromChart: true,
        },
      },
    });

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].label).toBe('Root');
    expect(snapshot.edges).toHaveLength(0);
  });

  it('keeps a fallback node when all hints are filtered out', () => {
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 's5',
      explorations: [
        makeExploration('exp_1', 100, 'complete', 0, 'hello'),
      ],
      summaries: { exp_1: 'greeting summary' },
      flowchartHints: {
        exp_1: {
          ...hint('greeting', '问候', null, 'trunk', 'low'),
          dropFromChart: true,
        },
      },
    });

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].label.length).toBeGreaterThan(0);
  });

  it('uses running title for active exploration without flowchart hint', () => {
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 's6',
      explorations: [
        makeExploration('exp_1', 100, 'running'),
      ],
      summaries: {},
    });
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].label.toLowerCase()).toBe('running');
  });

  it('uses generating title after completion when hint is not ready', () => {
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 's7',
      explorations: [
        makeExploration('exp_1', 100, 'complete'),
      ],
      summaries: {},
    });
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].label.toLowerCase()).toBe('generating');
  });

  it('merges repeated intent_key into one logical node', () => {
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 's4',
      explorations: [
        makeExploration('exp_1', 100, 'complete'),
        makeExploration('exp_2', 200, 'complete'),
      ],
      summaries: { exp_1: 'first', exp_2: 'second' },
      flowchartHints: {
        exp_1: hint('intent_a', 'Intent A', null, 'trunk', 'high', 'intent_a'),
        exp_2: hint('intent_a', 'Intent A refined', null, 'trunk', 'high', 'intent_a'),
      },
    });

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].label).toBe('Intent A refined');
    expect(snapshot.nodes[0].summaryPreview).toBe('second');
  });

  it('applies valid merge patch and keeps deterministic graph ids', () => {
    const originalHints = {
      exp_1: hint('intent_a', 'Intent A', null, 'trunk', 'high', 'intent_a'),
      exp_2: hint('intent_b', 'Intent B', 'intent_a', 'parallel', 'high', 'intent_b'),
    };
    const patched = applyGraphPatch(originalHints, [
      {
        op: 'merge_intents',
        sourceIntentKeys: ['intent_a', 'intent_b'],
        targetIntentKey: 'intent_ab',
        reason: 'same purpose',
        confidence: 0.9,
      },
    ]);
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 's8',
      explorations: [
        makeExploration('exp_1', 100, 'complete'),
        makeExploration('exp_2', 200, 'complete'),
      ],
      summaries: { exp_1: 'first', exp_2: 'second' },
      flowchartHints: patched.nextHints,
    });
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].id).toBe('s8:intent_ab_exp_2');
  });
});

function makeExploration(
  id: string,
  startedAt: number,
  status: Exploration['status'],
  systemErrors = 0,
  question = id,
): Exploration {
  return {
    id,
    question,
    startedAt,
    endedAt: startedAt + 10,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: systemErrors, result: 0 },
    nodes: [],
  };
}

function hint(
  nodeId: string,
  nodeTitle: string,
  parentId: string | null,
  branchType: FlowchartHint['branchType'],
  importance: FlowchartHint['importance'],
  intentKey: string = nodeId,
): FlowchartHint {
  return {
    nodeId,
    nodeTitle,
    parentId,
    branchType,
    importance,
    dropFromChart: false,
    intentKey,
  };
}
