import { describe, expect, it } from 'bun:test';
import type { GraphDigest } from '../session/graph-digest-service';
import { generateGraphConsolidationAI } from './graph-consolidation-service';

const digest: GraphDigest = {
  nodes: [
    { id: 's1:a', title: 'A', status: 'complete', parentIds: [], summary: 's1', updatedAt: 1 },
    { id: 's1:b', title: 'B', status: 'complete', parentIds: ['s1:a'], summary: 's2', updatedAt: 1 },
  ],
  edges: [{ from: 's1:a', to: 's1:b', relationship: 'main' }],
  generatedAt: 1,
};

describe('generateGraphConsolidationAI', () => {
  it('returns keep_incremental when evidence is insufficient', async () => {
    const result = await generateGraphConsolidationAI(
      { digest: { ...digest, nodes: [digest.nodes[0]], edges: [] } },
      async () => ({ ok: true, output: '{"action":"patch","graph_patch":[]}' }),
    );
    expect(result.action).toBe('keep_incremental');
  });

  it('parses valid patch response', async () => {
    const result = await generateGraphConsolidationAI(
      { digest },
      async () => ({
        ok: true,
        output: JSON.stringify({
          action: 'patch',
          graph_patch: [
            {
              op: 'rename_intent',
              target_intent_key: 'a',
              new_title: 'A Prime',
              reason: 'clearer naming',
              confidence: 0.8,
            },
          ],
        }),
      }),
    );
    expect(result.action).toBe('patch');
    expect(result.graphPatch.length).toBe(1);
  });
});
