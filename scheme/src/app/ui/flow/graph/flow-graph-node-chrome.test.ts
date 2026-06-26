import { describe, expect, it } from 'bun:test';
import type { FlowGraphNode } from '../../../../data/protocol/observer-protocol';
import {
  resolveGraphNodeChromeParts,
  resolveRailRowIndent,
} from './flow-graph-node-chrome';

function node(overrides: Partial<FlowGraphNode> = {}): FlowGraphNode {
  return {
    id: 's:1',
    explorationId: 'exp_1',
    label: 'Fix Focus',
    intentKey: 'implement',
    status: 'complete',
    startedAt: 1,
    summaryPreview: 'preview',
    metaBadges: { tools: 2, errors: 0, wiki: 'saved' },
    ...overrides,
  };
}

describe('flow-graph-node-chrome', () => {
  it('splits intent badge and title for task intents', () => {
    expect(resolveGraphNodeChromeParts(node(), 'en')).toEqual({
      badge: 'Implement',
      title: 'Fix Focus',
      isIdle: false,
    });
  });

  it('title only for greeting intent', () => {
    expect(resolveGraphNodeChromeParts(
      node({ intentKey: 'greeting' }),
      'en',
    )).toEqual({
      badge: null,
      title: 'Fix Focus',
      isIdle: true,
    });
  });

  it('uses zh-Hans intent labels', () => {
    expect(resolveGraphNodeChromeParts(node(), 'zh-Hans').badge).toBe('实现功能');
  });

  it('indents rail rows by depth', () => {
    expect(resolveRailRowIndent(0)).toBe(0);
    expect(resolveRailRowIndent(2)).toBe(6);
  });
});
