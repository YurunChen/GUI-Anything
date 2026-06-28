import { describe, expect, it } from 'bun:test';
import type { Exploration, SummaryItem } from '../../data/protocol/observer-protocol';
import {
  applyExcerptFallback,
  applyLiveSummaryPreview,
  buildLiveSummaryPreview,
  buildLiveSummaryPreviewFlowchart,
  finalizeExplorationSummaryItem,
  finalizeSummaryFromTimelineOnly,
} from './summary-display';

function exploration(status: Exploration['status'], question = 'q'): Exploration {
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

const existingSummary: SummaryItem = {
  id: 'session-1:exp_1',
  sessionId: 'session-1',
  explorationId: 'exp_1',
  text: '',
  source: 'cache',
  status: 'ready',
  persistMeta: {
    should_persist: true,
    type: 'context',
    confidence: 0.9,
    reason: 'existing-meta',
  },
  flowchart: {
    nodeId: 'existing-node',
    nodeTitle: 'Existing intent',
    parentId: null,
    branchType: 'trunk',
    importance: 'high',
    dropFromChart: false,
    intentKey: 'general',
    titleDelta: 'continue',
  },
};

describe('summary-display', () => {
  it('uses calm text on validation failure without error suffix', () => {
    const out = finalizeExplorationSummaryItem({
      question: 'hello',
      nodes: [{
        id: 'n1',
        timestamp: 1,
        type: 'response',
        label: 'Hi there',
      }],
      payload: {
        displaySummary: '',
        persist: null,
        validationError: 'missing_summary',
      },
    });
    expect(out.text).toBe('Ready when you are.');
    expect(out.text).not.toContain('格式异常');
    expect(out.persistMeta?.reason).toBe('skip');
  });

  it('timeline-only after agent failure is ready excerpt', () => {
    const out = finalizeSummaryFromTimelineOnly({
      question: 'fix bug',
      nodes: [{
        id: 'n1',
        timestamp: 1,
        type: 'tool',
        label: 'Read x',
      }],
      errorReason: 'always-fail',
    });
    expect(out.status).toBe('ready');
    expect(out.source).toBe('fallback');
  });

  it('skips live preview when bundle already has summary for exploration', () => {
    const items = applyLiveSummaryPreview({
      sessionId: 'session-1',
      explorations: [exploration('complete')],
      items: {},
      hasBundleSummaryByExplorationId: { exp_1: true },
    });
    expect(Object.keys(items)).toHaveLength(0);
  });

  it('adds live preview when bundle has no summary', () => {
    const items = applyLiveSummaryPreview({
      sessionId: 'session-1',
      explorations: [exploration('complete')],
      items: {},
    });
    expect(Object.values(items)[0]?.reason).toBe('live_preview');
  });

  it('preserves existing metadata when live preview fills missing text', () => {
    const items = applyLiveSummaryPreview({
      sessionId: 'session-1',
      explorations: [exploration('complete')],
      items: { 'session-1:exp_1': existingSummary },
    });
    expect(Object.values(items)[0]?.persistMeta).toEqual(existingSummary.persistMeta);
    expect(Object.values(items)[0]?.flowchart).toEqual(existingSummary.flowchart);
  });

  it('adds timeline excerpt fallback for replay display gaps', () => {
    const items = applyExcerptFallback({
      sessionId: 'session-1',
      explorations: [exploration('complete')],
      items: {},
    });
    expect(Object.values(items)[0]?.source).toBe('fallback');
    expect(Object.values(items)[0]?.reason).toBe('timeline_excerpt');
  });

  it('preserves existing metadata when replay excerpt fills missing text', () => {
    const items = applyExcerptFallback({
      sessionId: 'session-1',
      explorations: [exploration('complete')],
      items: { 'session-1:exp_1': existingSummary },
    });
    expect(Object.values(items)[0]?.persistMeta).toEqual(existingSummary.persistMeta);
    expect(Object.values(items)[0]?.flowchart).toEqual(existingSummary.flowchart);
  });

  it('greeting live preview shows distill Hero and idle flowchart title', () => {
    const greeting: Exploration = {
      ...exploration('complete', 'hello'),
      nodes: [{
        id: 'n1',
        timestamp: 1,
        type: 'response',
        label: 'Hello! What can I help you with?',
      }],
    };
    expect(buildLiveSummaryPreview(greeting)).toMatch(/就绪|Ready/);
    expect(buildLiveSummaryPreview(greeting)).not.toContain('Hello');
    expect(buildLiveSummaryPreviewFlowchart(greeting)?.titleDelta).toBe('idle');
    expect(buildLiveSummaryPreviewFlowchart(greeting)?.nodeTitle).toMatch(/待具体任务|Awaiting/);
  });
});
