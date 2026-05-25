import { describe, expect, it } from 'bun:test';
import type { Exploration, FlowchartHint } from './observer-protocol';
import {
  catalogIntentKeyFromHint,
  resolveFlowchartChromeFromHint,
  resolveLatestFlowchartChrome,
  slugFlowchartNodeId,
} from './flowchart-intent';

function hint(overrides: Partial<FlowchartHint> & Pick<FlowchartHint, 'nodeTitle' | 'intentKey'>): FlowchartHint {
  return {
    nodeId: 'n1',
    parentId: null,
    branchType: 'trunk',
    importance: 'medium',
    dropFromChart: false,
    ...overrides,
  };
}

describe('catalogIntentKeyFromHint', () => {
  it('normalizes catalog key only from intentKey field', () => {
    expect(catalogIntentKeyFromHint(hint({ intentKey: 'explore', nodeTitle: 'Read code' }))).toBe('explore');
    expect(catalogIntentKeyFromHint(hint({ intentKey: 'explore', nodeTitle: 'Read', nodeId: 'wiki_chain' }))).toBe('explore');
  });

  it('does not infer catalog key from nodeId', () => {
    expect(catalogIntentKeyFromHint(hint({ intentKey: '', nodeTitle: 'x', nodeId: 'wiki_chain' }))).toBe('general');
  });
});

describe('slugFlowchartNodeId', () => {
  it('slugs node_id and ignores intent_key', () => {
    expect(slugFlowchartNodeId('wiki_chain_review')).toBe('wiki_chain_review');
    expect(slugFlowchartNodeId(undefined, 'exp_1')).toBe('exp_exp_1');
  });
});

describe('resolveLatestFlowchartChrome', () => {
  it('prefers latest non-greeting completed exploration', () => {
    const explorations: Exploration[] = [
      {
        id: 'exp_1',
        question: 'a',
        startedAt: 1,
        endedAt: 2,
        status: 'complete',
        currentPhase: 'idle',
        phaseSeen: { explore: false, execute: false, verify: false },
        errorCounts: { tool: 0, system: 0, result: 0 },
        nodes: [],
      },
      {
        id: 'exp_2',
        question: 'b',
        startedAt: 3,
        endedAt: 4,
        status: 'complete',
        currentPhase: 'idle',
        phaseSeen: { explore: false, execute: false, verify: false },
        errorCounts: { tool: 0, system: 0, result: 0 },
        nodes: [],
      },
    ];
    const chrome = resolveLatestFlowchartChrome({
      explorations,
      itemsByExplorationId: {
        exp_1: {
          id: 's1:exp_1',
          sessionId: 's1',
          explorationId: 'exp_1',
          text: 'a',
          source: 'ai',
          status: 'ready',
          persistMeta: null,
          flowchart: hint({ intentKey: 'explore', nodeTitle: 'First', nodeId: 'n1' }),
        },
        exp_2: {
          id: 's1:exp_2',
          sessionId: 's1',
          explorationId: 'exp_2',
          text: 'b',
          source: 'ai',
          status: 'ready',
          persistMeta: null,
          flowchart: hint({
            intentKey: 'explore',
            nodeTitle: 'Wiki chain',
            nodeId: 'wiki_chain',
          }),
        },
      },
    });
    expect(chrome).toEqual({ intentKey: 'explore', title: 'Wiki chain' });
  });
});

describe('resolveFlowchartChromeFromHint', () => {
  it('returns undefined for greeting', () => {
    expect(resolveFlowchartChromeFromHint(hint({
      intentKey: 'greeting',
      nodeTitle: 'Awaiting',
      dropFromChart: true,
      titleDelta: 'idle',
    }))).toBeUndefined();
  });
});
