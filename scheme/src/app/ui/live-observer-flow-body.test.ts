import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../data/protocol/observer-protocol';
import {
  lineDisplayWidth,
  summaryTextColumns,
  summaryTextareaHeight,
  wrapFlowText,
} from './flow/summary-layout';
import { sortTimelineEntries } from './live-observer-flow-body';
import { buildFlowGraphSnapshot } from '../observer/view-model/flow-graph-builder';
import { shouldShowInlineSummary } from '../observer/view-model/exploration-card-view';

function makeExploration(
  id: string,
  startedAt: number,
  endedAt: number | undefined,
  status: Exploration['status'] = 'complete',
): Exploration {
  return {
    id,
    question: id,
    startedAt,
    endedAt,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [],
  };
}

describe('summary text wrapping', () => {
  it('counts CJK characters as double-width', () => {
    expect(lineDisplayWidth('abc')).toBe(3);
    expect(lineDisplayWidth('方案')).toBe(4);
    expect(lineDisplayWidth('A方案')).toBe(5);
  });

  it('wraps text without adding safety blank lines', () => {
    const text = '用户请我看 POCKETFLOW_INTEGRATION_PLAN.md 方案可行性。';
    const lines = wrapFlowText(text, 20);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.at(-1)).not.toBe('');
    expect(summaryTextareaHeight(text, 28)).toBe(lines.length);
    for (const line of lines) {
      expect(lineDisplayWidth(line)).toBeLessThanOrEqual(20);
    }
  });

  it('reserves layout columns before wrapping summary text', () => {
    expect(summaryTextColumns(80)).toBe(72);
    expect(summaryTextColumns(24)).toBe(20);
  });
});

describe('single rail timeline order', () => {
  it('sorts explorations by startedAt with stable fallbacks', () => {
    const sorted = sortTimelineEntries([
      makeExploration('late', 300, 340),
      makeExploration('same-start-end-late', 200, 260),
      makeExploration('same-start-end-early', 200, 220),
      makeExploration('early', 100, undefined, 'running'),
    ]);

    expect(sorted.map((entry) => entry.exploration.id)).toEqual([
      'early',
      'same-start-end-early',
      'same-start-end-late',
      'late',
    ]);
  });
});

describe('summary dedup gating', () => {
  it('shows inline summary when complete or interrupted (even while generating)', () => {
    expect(shouldShowInlineSummary('expanded', 'complete', false)).toBe(true);
    expect(shouldShowInlineSummary('expanded', 'complete', true)).toBe(true);
    expect(shouldShowInlineSummary('compact', 'complete', false)).toBe(false);
    expect(shouldShowInlineSummary('expanded', 'running', false)).toBe(false);
    expect(shouldShowInlineSummary('expanded', 'interrupted', false)).toBe(true);
  });
});

describe('inline summary layout', () => {
  it('uses native word wrap via FlowTextBlock (no manual line splitting)', () => {
    expect(shouldShowInlineSummary('expanded', 'complete', false)).toBe(true);
  });
});

describe('post-turn graph refresh', () => {
  it('adds a new node when a completed turn is appended', () => {
    const base = buildFlowGraphSnapshot({
      sessionId: 'session-x',
      explorations: [
        makeExploration('exp_1', 100, 120, 'complete'),
      ],
      summaries: { exp_1: 'summary-1' },
    });
    const next = buildFlowGraphSnapshot({
      sessionId: 'session-x',
      explorations: [
        makeExploration('exp_1', 100, 120, 'complete'),
        makeExploration('exp_2', 130, 160, 'complete'),
      ],
      summaries: { exp_1: 'summary-1', exp_2: 'summary-2' },
    });

    expect(base.nodes.length).toBe(1);
    expect(next.nodes.length).toBe(2);
    expect(next.edges.length).toBe(1);
    expect(next.nodes.at(-1)?.id).toContain('exp_2');
  });

  it('keeps focus on running exploration, then latest completed', () => {
    const running = buildFlowGraphSnapshot({
      sessionId: 'session-y',
      explorations: [
        makeExploration('exp_1', 100, 120, 'complete'),
        makeExploration('exp_2', 130, undefined, 'running'),
      ],
      summaries: { exp_1: 'summary-1' },
    });
    expect(running.focusNodeId).toContain('exp_2');

    const completed = buildFlowGraphSnapshot({
      sessionId: 'session-y',
      explorations: [
        makeExploration('exp_1', 100, 120, 'complete'),
        makeExploration('exp_2', 130, 170, 'complete'),
      ],
      summaries: { exp_1: 'summary-1', exp_2: 'summary-2' },
    });
    expect(completed.focusNodeId).toContain('exp_2');
  });

  it('filters low-value flowchart hints and keeps intent nodes only', () => {
    const snapshot = buildFlowGraphSnapshot({
      sessionId: 'session-z',
      explorations: [
        makeExploration('exp_1', 100, 120, 'complete'),
        makeExploration('exp_2', 130, 160, 'complete'),
      ],
      summaries: {
        exp_1: 'summary-1',
        exp_2: 'summary-2',
      },
      flowchartHints: {
        exp_1: {
          nodeId: 'core_intent',
          nodeTitle: '核心目标',
          parentId: null,
          branchType: 'trunk',
          importance: 'high',
          dropFromChart: false,
          intentKey: 'core_intent',
        },
        exp_2: {
          nodeId: 'noise_intent',
          nodeTitle: '噪音节点',
          parentId: 'core_intent',
          branchType: 'parallel',
          importance: 'low',
          dropFromChart: false,
          intentKey: 'noise_intent',
        },
      },
    });

    expect(snapshot.nodes.map((node) => node.label)).toEqual(['核心目标']);
    expect(snapshot.edges).toHaveLength(0);
  });
});
