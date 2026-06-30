import { describe, expect, it } from 'bun:test';
import type {
  Exploration,
  FlowGraphNode,
  FlowGraphSnapshot,
} from '../../data/protocol/observer-protocol';
import {
  buildLivePersonaNodes,
  LIVE_PERSONA_MIN_COMPLETED_EXPLORATIONS,
  LIVE_PERSONA_REFRESH_COMPLETED_EXPLORATIONS,
  resolveLiveCodingPersona,
  stableLivePersonaExplorations,
} from './live-persona';

const START = new Date(2026, 0, 1, 12, 0, 0).getTime();

function graphNode(partial: Partial<FlowGraphNode> = {}): FlowGraphNode {
  return {
    id: 's1:e1',
    explorationId: 'e1',
    intentKey: 'implement',
    label: '实现底部人格',
    status: 'complete',
    startedAt: START,
    endedAt: START + 1000,
    summaryPreview: '完成底部 personality 类型展示',
    metaBadges: {
      tools: 4,
      errors: 0,
      wiki: 'saved',
    },
    ...partial,
  };
}

function snapshot(nodes: FlowGraphNode[]): FlowGraphSnapshot {
  return {
    nodes,
    edges: [],
    focusNodeId: nodes.at(-1)?.id,
    updatedAt: START,
  };
}

function exploration(partial: Partial<Exploration> = {}): Exploration {
  return {
    id: 'e1',
    question: '实现底部人格展示',
    status: 'complete',
    startedAt: START,
    endedAt: START + 1000,
    nodes: [
      { id: 'n1', type: 'tool', text: 'edit', timestamp: START },
      { id: 'n2', type: 'tool', text: 'test', timestamp: START + 1 },
    ],
    files: [],
    fileActivity: [],
    errorCounts: { tool: 0, system: 0, result: 0 },
    ...partial,
  } as Exploration;
}

describe('live persona resolver', () => {
  it('returns null when no graph node exists', () => {
    expect(resolveLiveCodingPersona({
      graphSnapshot: snapshot([]),
      explorations: [],
    })).toBeNull();
  });

  it('builds persona nodes from observer protocol data', () => {
    const nodes = buildLivePersonaNodes({
      graphSnapshot: snapshot([graphNode()]),
      explorations: [exploration()],
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].metrics?.toolCount).toBe(4);
    expect(nodes[0].metrics?.writes).toBe(1);
  });

  it('keeps graph bucket aggregate tools and folds matching explorations into child depth', () => {
    const nodes = buildLivePersonaNodes({
      graphSnapshot: snapshot([graphNode({
        metaBadges: { tools: 7, errors: 2, wiki: 'updated' },
      })]),
      explorations: [
        exploration({ id: 'e1' }),
        exploration({ id: 'e2', question: '继续实现底部人格展示', startedAt: START + 2000 }),
      ],
      flowchartHints: {
        e1: {
          nodeId: 'persona-strip',
          nodeTitle: '实现底部人格',
          parentId: null,
          branchType: 'trunk',
          importance: 'medium',
          dropFromChart: false,
          intentKey: 'implement',
          titleDelta: 'pivot',
        },
        e2: {
          nodeId: 'persona-strip',
          nodeTitle: '继续实现底部人格',
          parentId: null,
          branchType: 'trunk',
          importance: 'medium',
          dropFromChart: false,
          intentKey: 'implement',
          titleDelta: 'continue',
        },
      },
      explorationPersistStatus: {
        e1: 'saved',
        e2: 'updated',
      },
      wikiMatchesByExploration: {
        e2: {
          entry: {
            id: 'k1',
            slug: 'persona-note',
            sessionId: 's1',
            explorationId: 'e2',
            type: 'context',
            request: '继续实现底部人格展示',
            content: 'prior knowledge',
            confidence: 0.9,
            tags: [],
            createdAt: START,
            updatedAt: START,
          },
          score: 0.9,
          matchedKeywords: ['persona'],
        },
      },
    });

    expect(nodes[0].metrics?.toolCount).toBe(7);
    expect(nodes[0].metrics?.errorCount).toBe(2);
    expect(nodes[0].metrics?.writes).toBe(2);
    expect(nodes[0].metrics?.retrievals).toBe(1);
    expect(nodes[0].children).toHaveLength(1);
    expect(nodes[0].delta).toBe('pivot');
  });

  it('waits for enough completed explorations before showing a persona', () => {
    const persona = resolveLiveCodingPersona({
      graphSnapshot: snapshot([
        graphNode({ id: 's1:e1', explorationId: 'e1' }),
        graphNode({ id: 's1:e2', explorationId: 'e2' }),
        graphNode({ id: 's1:e3', explorationId: 'e3' }),
      ]),
      explorations: [
        exploration({ id: 'e1' }),
        exploration({ id: 'e2', startedAt: START + 1000 }),
        exploration({ id: 'e3', status: 'running', startedAt: START + 2000 }),
      ],
    });

    expect(persona).toBeNull();
  });

  it('shows a persona after the first stable completed-exploration window', () => {
    const persona = resolveLiveCodingPersona({
      graphSnapshot: snapshot([
        graphNode({ id: 's1:e1', explorationId: 'e1' }),
        graphNode({ id: 's1:e2', explorationId: 'e2' }),
        graphNode({ id: 's1:e3', explorationId: 'e3' }),
      ]),
      explorations: [
        exploration({ id: 'e1' }),
        exploration({ id: 'e2', startedAt: START + 1000 }),
        exploration({ id: 'e3', startedAt: START + 2000 }),
      ],
    });

    expect(persona).not.toBeNull();
  });

  it('uses completed exploration checkpoints so the persona does not jump on every turn', () => {
    const explorations = [
      exploration({ id: 'e1', startedAt: START + 1000 }),
      exploration({ id: 'e2', startedAt: START + 2000 }),
      exploration({ id: 'e3', startedAt: START + 3000 }),
      exploration({ id: 'e4', startedAt: START + 4000 }),
      exploration({ id: 'e5', startedAt: START + 5000 }),
    ];

    expect(stableLivePersonaExplorations(explorations.slice(0, 2))).toEqual([]);
    expect(stableLivePersonaExplorations(explorations).map((item) => item.id)).toEqual(['e1', 'e2', 'e3']);
    expect(LIVE_PERSONA_MIN_COMPLETED_EXPLORATIONS).toBe(3);
    expect(LIVE_PERSONA_REFRESH_COMPLETED_EXPLORATIONS).toBe(3);
  });

  it('does not let post-checkpoint explorations change the displayed persona before the next checkpoint', () => {
    const firstThreeNodes = [
      graphNode({ id: 's1:e1', explorationId: 'e1', metaBadges: { tools: 2, errors: 0, wiki: 'saved' } }),
      graphNode({ id: 's1:e2', explorationId: 'e2', metaBadges: { tools: 2, errors: 0, wiki: 'saved' } }),
      graphNode({ id: 's1:e3', explorationId: 'e3', metaBadges: { tools: 2, errors: 0, wiki: 'saved' } }),
    ];
    const firstThreeExplorations = [
      exploration({ id: 'e1', startedAt: START + 1000 }),
      exploration({ id: 'e2', startedAt: START + 2000 }),
      exploration({ id: 'e3', startedAt: START + 3000 }),
    ];
    const initialPersona = resolveLiveCodingPersona({
      graphSnapshot: snapshot(firstThreeNodes),
      explorations: firstThreeExplorations,
      explorationPersistStatus: { e1: 'saved', e2: 'saved', e3: 'saved' },
    });
    const fourthTurnPersona = resolveLiveCodingPersona({
      graphSnapshot: snapshot([
        ...firstThreeNodes,
        graphNode({
          id: 's1:e4',
          explorationId: 'e4',
          metaBadges: { tools: 20, errors: 8, wiki: 'skipped' },
        }),
      ]),
      explorations: [
        ...firstThreeExplorations,
        exploration({
          id: 'e4',
          startedAt: START + 4000,
          nodes: [{ id: 'n4', type: 'tool', label: 'debug', timestamp: START + 4000 }],
          errorCounts: { tool: 8, system: 0, result: 0 },
        }),
      ],
      explorationPersistStatus: { e1: 'saved', e2: 'saved', e3: 'saved', e4: 'skipped' },
    });

    expect(fourthTurnPersona?.archetypeCode).toBe(initialPersona?.archetypeCode);
    expect(fourthTurnPersona?.signatureNodeId).toBe(initialPersona?.signatureNodeId);
  });

  it('keeps merged graph buckets pinned to the stable checkpoint representative', () => {
    const flowchartHints = {
      e1: {
        nodeId: 'persona-strip',
        nodeTitle: '实现底部人格',
        parentId: null,
        branchType: 'trunk',
        importance: 'medium',
        dropFromChart: false,
        intentKey: 'implement',
        titleDelta: 'pivot',
      },
      e2: {
        nodeId: 'persona-strip',
        nodeTitle: '实现底部人格',
        parentId: null,
        branchType: 'trunk',
        importance: 'medium',
        dropFromChart: false,
        intentKey: 'implement',
        titleDelta: 'continue',
      },
      e3: {
        nodeId: 'persona-strip',
        nodeTitle: '实现底部人格',
        parentId: null,
        branchType: 'trunk',
        importance: 'medium',
        dropFromChart: false,
        intentKey: 'implement',
        titleDelta: 'continue',
      },
      e4: {
        nodeId: 'persona-strip',
        nodeTitle: '实现底部人格',
        parentId: null,
        branchType: 'trunk',
        importance: 'medium',
        dropFromChart: false,
        intentKey: 'implement',
        titleDelta: 'continue',
      },
    } as const;
    const firstThreeExplorations = [
      exploration({ id: 'e1', startedAt: START + 1000 }),
      exploration({ id: 'e2', startedAt: START + 2000 }),
      exploration({ id: 'e3', startedAt: START + 3000 }),
    ];
    const initialPersona = resolveLiveCodingPersona({
      graphSnapshot: snapshot([
        graphNode({
          id: 's1:persona_strip_e3',
          explorationId: 'e3',
          metaBadges: { tools: 6, errors: 0, wiki: 'saved' },
        }),
      ]),
      explorations: firstThreeExplorations,
      flowchartHints,
      explorationPersistStatus: { e1: 'saved', e2: 'saved', e3: 'saved' },
    });
    const fourthTurnPersona = resolveLiveCodingPersona({
      graphSnapshot: snapshot([
        graphNode({
          id: 's1:persona_strip_e4',
          explorationId: 'e4',
          status: 'error',
          metaBadges: { tools: 26, errors: 8, wiki: 'skipped' },
        }),
      ]),
      explorations: [
        ...firstThreeExplorations,
        exploration({
          id: 'e4',
          startedAt: START + 4000,
          nodes: [{ id: 'n4', type: 'tool', label: 'debug', timestamp: START + 4000 }],
          errorCounts: { tool: 8, system: 0, result: 0 },
        }),
      ],
      flowchartHints,
      explorationPersistStatus: { e1: 'saved', e2: 'saved', e3: 'saved', e4: 'skipped' },
    });

    expect(fourthTurnPersona?.archetypeCode).toBe(initialPersona?.archetypeCode);
    expect(fourthTurnPersona?.signatureNodeId).toBe(initialPersona?.signatureNodeId);
  });

  it('does not award a legendary persona as soon as the persona first appears', () => {
    const persona = resolveLiveCodingPersona({
      graphSnapshot: snapshot([
        graphNode({ id: 's1:e1', explorationId: 'e1', metaBadges: { tools: 4, errors: 0, wiki: 'saved' } }),
        graphNode({ id: 's1:e2', explorationId: 'e2', metaBadges: { tools: 4, errors: 0, wiki: 'saved' } }),
        graphNode({ id: 's1:e3', explorationId: 'e3', metaBadges: { tools: 4, errors: 0, wiki: 'saved' } }),
      ]),
      explorations: [
        exploration({ id: 'e1' }),
        exploration({ id: 'e2', startedAt: START + 1000 }),
        exploration({ id: 'e3', startedAt: START + 2000 }),
      ],
      explorationPersistStatus: { e1: 'saved', e2: 'saved', e3: 'saved' },
    });

    expect(persona?.rarity).not.toBe('legendary');
    expect(persona?.archetypeCode).not.toBe('STAR');
  });
});
