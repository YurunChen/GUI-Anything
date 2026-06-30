import { describe, expect, it } from 'bun:test';
import { deduplicateKnowledge } from './data-governance';
import type { KnowledgeEntry } from '../wiki/knowledge-repository';

function makeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'C002',
    slug: 'flow-observer',
    sessionId: 'sess-1',
    explorationId: 'exp-1',
    type: 'context',
    request: '分析项目',
    content: 'body',
    confidence: 0.8,
    tags: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('deduplicateKnowledge', () => {
  it('treats same id as refresh instead of already_exists_same_source skip', async () => {
    const entry = makeEntry();
    const repo = {
      findBySource: async () => entry,
      listByType: async () => [],
    };

    const result = await deduplicateKnowledge(entry, repo as never);
    expect(result.action).toBe('update');
    expect(result.reason).toBe('same_entry_refresh');
    expect(result.targetId).toBe('C002');
  });

  it('does not deduplicate against another project entry', async () => {
    const entry = makeEntry({ tags: ['proj:gui-anything'] });
    const repo = {
      findBySource: async () => null,
      listByType: async () => [
        makeEntry({
          id: 'C001',
          request: '分析项目',
          tags: ['proj:other-project'],
        }),
      ],
    };

    const result = await deduplicateKnowledge(entry, repo as never);
    expect(result.action).toBe('create');
  });

  it('still deduplicates explicit global knowledge', async () => {
    const entry = makeEntry({ tags: ['scope:global'] });
    const repo = {
      findBySource: async () => null,
      listByType: async () => [
        makeEntry({
          id: 'C001',
          request: '分析项目',
          tags: ['scope:global'],
        }),
      ],
    };

    const result = await deduplicateKnowledge(entry, repo as never);
    expect(result.action).toBe('skip');
    expect(result.targetId).toBe('C001');
  });
});
