import { describe, expect, it } from 'bun:test';
import { buildLiveSummaryPreview, buildLiveSummaryPreviewFlowchart } from './live-summary-preview';
import type { Exploration } from '../../../data/protocol/observer-protocol';

describe('live summary preview', () => {
  it('greeting shows distill Hero and idle flowchart title', () => {
    const exploration: Exploration = {
      id: 'exp_1',
      question: 'hello',
      startedAt: 1,
      status: 'complete',
      currentPhase: 'idle',
      phaseSeen: { explore: true, execute: false, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
      nodes: [{
        id: 'n1',
        timestamp: 1,
        type: 'response',
        label: 'Hello! What can I help you with?',
      }],
    };
    expect(buildLiveSummaryPreview(exploration)).toMatch(/就绪|Ready/);
    expect(buildLiveSummaryPreview(exploration)).not.toContain('Hello');
    expect(buildLiveSummaryPreviewFlowchart(exploration)?.titleDelta).toBe('idle');
    expect(buildLiveSummaryPreviewFlowchart(exploration)?.nodeTitle).toMatch(/待具体任务|Awaiting/);
  });
});
