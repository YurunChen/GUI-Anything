import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../data/protocol/observer-protocol';
import {
  extractWikiSearchQuery,
  filterPriorKnowledge,
  isSameTurnKnowledge,
} from './wiki-retrieval-policy';
import type { KnowledgeEntry } from '../../data/wiki/knowledge-repository';

function makeExploration(question: string, nodes: Exploration['nodes'] = []): Exploration {
  return {
    id: 'exp_1',
    question,
    startedAt: 100,
    endedAt: 200,
    status: 'complete',
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes,
  };
}

describe('extractWikiSearchQuery', () => {
  it('returns question when long enough', () => {
    expect(extractWikiSearchQuery(makeExploration('分析当前项目结构'))).toBe('分析当前项目结构');
  });

  it('falls back to response node text', () => {
    const exploration = makeExploration('', [
      { id: 'n1', type: 'response', label: 'resp', status: 'ok', rawText: '这是一段足够长的回复文本用于匹配', timestamp: 100 },
    ]);
    expect(extractWikiSearchQuery(exploration)).toBe('这是一段足够长的回复文本用于匹配');
  });

  it('returns null for short or missing query', () => {
    expect(extractWikiSearchQuery(undefined)).toBeNull();
    expect(extractWikiSearchQuery(makeExploration('hi'))).toBeNull();
    expect(extractWikiSearchQuery(makeExploration(''))).toBeNull();
  });
});

function entry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'C001',
    slug: 'x',
    sessionId: 's1',
    explorationId: 'exp_2',
    type: 'context',
    request: 'q',
    content: 'c',
    confidence: 1,
    tags: [],
    createdAt: 0,
    ...overrides,
  };
}

describe('wiki-retrieval-policy', () => {
  it('excludes same session+exploration turn', () => {
    expect(isSameTurnKnowledge(entry(), { sessionId: 's1', explorationId: 'exp_2' })).toBe(true);
    expect(isSameTurnKnowledge(entry({ explorationId: 'exp_1' }), { sessionId: 's1', explorationId: 'exp_2' })).toBe(false);
  });

  it('filterPriorKnowledge keeps other turns', () => {
    const prior = entry({ explorationId: 'exp_1' });
    const current = entry({ explorationId: 'exp_2' });
    const filtered = filterPriorKnowledge([prior, current], { sessionId: 's1', explorationId: 'exp_2' });
    expect(filtered).toEqual([prior]);
  });
});
