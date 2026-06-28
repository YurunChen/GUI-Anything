import { describe, expect, it } from 'bun:test';
import type {
  Exploration,
  FlowGraphNode,
  FlowGraphSnapshot,
} from '../../data/protocol/observer-protocol';
import { buildLivePersonaNodes, resolveLiveCodingPersona } from './live-persona';

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

  it('does not award a legendary persona for the first saved request', () => {
    const persona = resolveLiveCodingPersona({
      graphSnapshot: snapshot([graphNode({ metaBadges: { tools: 4, errors: 0, wiki: 'saved' } })]),
      explorations: [exploration()],
    });

    expect(persona?.rarity).not.toBe('legendary');
    expect(persona?.cnName).not.toBe('六边形战士');
  });

  it('does not show a hidden persona for the first unsaved request', () => {
    const persona = resolveLiveCodingPersona({
      graphSnapshot: snapshot([graphNode({ metaBadges: { tools: 4, errors: 0, wiki: 'skipped' } })]),
      explorations: [exploration()],
    });

    expect(persona?.rarity).not.toBe('hidden');
    expect(persona?.cnName).not.toBe('查无沉淀');
  });
});
