import { describe, expect, it } from 'bun:test';
import {
  isPivotCloseEvent,
  resolveIntentWikiPhase,
  resolveWikiPersistPhase,
} from './wiki-persist-policy';
import type { Exploration, FlowchartHint, SummaryItem } from '../../data/protocol/observer-protocol';

function exploration(status: Exploration['status'] = 'complete'): Exploration {
  return {
    id: 'exp_1',
    question: 'q',
    startedAt: 0,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [{ id: 'n1', type: 'tool', label: 'bash', status: 'ok', timestamp: 1 }],
  };
}

function summary(overrides: Partial<SummaryItem> = {}): SummaryItem {
  return {
    id: 's:exp_1',
    sessionId: 's',
    explorationId: 'exp_1',
    text: 'done',
    source: 'ai',
    status: 'ready',
    persistMeta: null,
    ...overrides,
  };
}

function flowchart(delta: FlowchartHint['titleDelta'], intentKey = 'topic_b'): FlowchartHint {
  return {
    nodeId: 'n1',
    nodeTitle: 'Title',
    parentId: null,
    branchType: 'trunk',
    importance: 'medium',
    dropFromChart: false,
    intentKey,
    titleDelta: delta,
  };
}

describe('resolveIntentWikiPhase', () => {
  it('accumulates when summary ready and not pivot', () => {
    expect(resolveIntentWikiPhase({
      exploration: exploration(),
      summaryItem: summary({ flowchart: flowchart('continue', 'topic_a') }),
    })).toBe('accumulate');
  });

  it('curates on pivot close', () => {
    expect(resolveIntentWikiPhase({
      exploration: exploration(),
      summaryItem: summary({ flowchart: flowchart('pivot') }),
      isPivotClose: true,
    })).toBe('curate_intent');
  });

  it('is done when bucket already curated', () => {
    expect(resolveIntentWikiPhase({
      exploration: exploration(),
      summaryItem: summary(),
      bucket: {
        intentKey: 'topic_a',
        nodeTitle: 'A',
        explorationIds: ['exp_1'],
        curatedAt: 1,
      },
    })).toBe('done');
  });
});

describe('isPivotCloseEvent', () => {
  it('detects pivot between real intents', () => {
    expect(isPivotCloseEvent(
      {
        sessionId: 's',
        revision: 1,
        intentKey: 'topic_a',
        nodeTitle: 'A',
        parentIntentKey: null,
        phase: 'active',
        history: [],
        updatedAt: 1,
      },
      flowchart('pivot', 'topic_b'),
    )).toBe(true);
  });
});

describe('legacy resolveWikiPersistPhase', () => {
  it('still runs agent per exploration in legacy mode tests', () => {
    expect(resolveWikiPersistPhase({
      exploration: exploration(),
      summaryItem: summary({ flowchart: flowchart('continue', 'topic_a') }),
    })).toBe('run_agent');
  });
});
