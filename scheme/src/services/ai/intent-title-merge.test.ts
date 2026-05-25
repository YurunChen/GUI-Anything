import { describe, expect, it } from 'bun:test';
import { isGreetingFlowchart, mergeIntentTitleState, resolveTitleDelta } from './intent-title-merge';
import { buildGreetingFlowchartHint } from './flow-summaries';
import type { FlowchartHint } from '../../data/protocol/observer-protocol';

function hint(overrides: Partial<FlowchartHint> & Pick<FlowchartHint, 'nodeTitle' | 'intentKey'>): FlowchartHint {
  return {
    nodeId: overrides.intentKey,
    parentId: null,
    branchType: 'trunk',
    importance: 'medium',
    dropFromChart: false,
    titleDelta: 'continue',
    ...overrides,
  };
}

describe('mergeIntentTitleState', () => {
  it('starts session with pivot', () => {
    const state = mergeIntentTitleState(null, 's1', {
      explorationId: 'exp_1',
      hint: hint({ intentKey: 'ux', nodeTitle: '心流提示词', titleDelta: 'pivot' }),
    });
    expect(state.intentKey).toBe('ux');
    expect(state.nodeTitle).toBe('心流提示词');
    expect(state.history).toHaveLength(1);
  });

  it('refines title under same intent_key', () => {
    const first = mergeIntentTitleState(null, 's1', {
      explorationId: 'exp_1',
      hint: hint({ intentKey: 'ux', nodeTitle: '心流提示词', titleDelta: 'pivot' }),
    });
    const second = mergeIntentTitleState(first, 's1', {
      explorationId: 'exp_2',
      hint: hint({ intentKey: 'ux', nodeTitle: '单一动态目标', titleDelta: 'refine' }),
    });
    expect(second.intentKey).toBe('ux');
    expect(second.nodeTitle).toBe('单一动态目标');
    expect(second.revision).toBe(2);
  });

  it('coerces pivot when leaving greeting', () => {
    const greeting = buildGreetingFlowchartHint();
    const prior = mergeIntentTitleState(null, 's1', {
      explorationId: 'exp_1',
      hint: greeting,
    });
    const delta = resolveTitleDelta(prior, hint({
      intentKey: 'project',
      nodeTitle: '项目分析',
      titleDelta: 'continue',
    }));
    expect(delta).toBe('pivot');
    expect(isGreetingFlowchart(greeting)).toBe(true);
  });

  it('pivot creates new intent_key', () => {
    const first = mergeIntentTitleState(null, 's1', {
      explorationId: 'exp_1',
      hint: hint({ intentKey: 'ux', nodeTitle: '心流', titleDelta: 'pivot' }),
    });
    const second = mergeIntentTitleState(first, 's1', {
      explorationId: 'exp_2',
      hint: hint({ intentKey: 'wiki', nodeTitle: '知识库布局', titleDelta: 'pivot' }),
    });
    expect(second.intentKey).toBe('wiki');
    expect(second.parentIntentKey).toBe('ux');
  });
});
