import { describe, expect, it } from 'bun:test';
import type { FlowGraphSnapshot } from '../../data/protocol/observer-protocol';
import { buildGraphDigest } from './graph-digest-service';

function makeSnapshot(): FlowGraphSnapshot {
  return {
    nodes: [
      {
        id: 's1:a',
        explorationId: 'a',
        label: 'A',
        status: 'complete',
        startedAt: 10,
        endedAt: 20,
        summaryPreview: 'A summary',
        metaBadges: { tools: 1, errors: 0, wiki: 'none' },
      },
      {
        id: 's1:b',
        explorationId: 'b',
        label: 'B',
        status: 'complete',
        startedAt: 30,
        endedAt: 40,
        summaryPreview: 'B summary',
        metaBadges: { tools: 1, errors: 0, wiki: 'none' },
      },
    ],
    edges: [{ from: 's1:a', to: 's1:b', kind: 'trunk' }],
    focusNodeId: 's1:b',
    updatedAt: 100,
  };
}

describe('buildGraphDigest', () => {
  it('builds deterministic digest with capped nodes', () => {
    const digest = buildGraphDigest(makeSnapshot(), { maxNodes: 1 });
    expect(digest.nodes.length).toBeLessThanOrEqual(1);
    expect(digest.nodes[0].id).toBe('s1:b');
  });
});
