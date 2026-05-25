import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import type { WikiMatch } from '../../../data/protocol/wiki-types';
import { resolveWikiTurnUi } from './wiki-turn-chrome';

function exploration(
  status: Exploration['status'],
  question = '分析当前项目结构与模块边界',
): Exploration {
  return {
    id: 'exp_1',
    question,
    startedAt: 0,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [{ id: 'n1', type: 'tool', label: 'bash', status: 'ok', timestamp: 1 }],
  };
}

const wikiMatch: WikiMatch = {
  entry: {
    id: 'C001',
    slug: 'topic',
    sessionId: 's',
    explorationId: 'exp_0',
    type: 'context',
    request: '分析',
    content: 'body',
    confidence: 0.9,
    tags: [],
    createdAt: 1,
  },
  score: 0.9,
  matchedKeywords: ['分析'],
};

describe('resolveWikiTurnUi', () => {
  it('shows knowledge on running turn with match', () => {
    const ui = resolveWikiTurnUi({
      exploration: exploration('running'),
      displayMode: 'expanded',
      wikiMatch,
    });
    expect(ui.showKnowledgeCard).toBe(true);
  });

  it('hides knowledge in compact mode', () => {
    const ui = resolveWikiTurnUi({
      exploration: exploration('complete'),
      displayMode: 'compact',
      wikiMatch,
    });
    expect(ui.showKnowledgeCard).toBe(false);
  });
});
