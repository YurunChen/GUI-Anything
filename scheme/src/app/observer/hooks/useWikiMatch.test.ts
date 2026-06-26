import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import { extractWikiSearchQuery } from '../../../services/wiki/wiki-retrieval-policy';

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
