import { describe, expect, it } from 'bun:test';
import { buildSessionArc } from './session-arc';
import type { Exploration } from '../../../data/protocol/observer-protocol';

describe('buildSessionArc', () => {
  it('returns undefined for fewer than two steps', () => {
    const explorations = [makeExp('e1', 'hello', 'complete')];
    expect(buildSessionArc(explorations, {})).toBeUndefined();
  });

  it('joins labels from flowchart titles', () => {
    const explorations = [
      makeExp('e1', 'q1', 'complete'),
      makeExp('e2', 'q2', 'complete'),
    ];
    const arc = buildSessionArc(explorations, {
      e1: {
        id: 's:e1',
        sessionId: 's',
        explorationId: 'e1',
        text: 'long summary one',
        source: 'ai',
        status: 'ready',
        persistMeta: null,
        flowchart: {
          nodeId: 'a',
          nodeTitle: '问候',
          parentId: null,
          branchType: 'trunk',
          importance: 'low',
          dropFromChart: true,
          intentKey: 'greeting',
        },
      },
      e2: {
        id: 's:e2',
        sessionId: 's',
        explorationId: 'e2',
        text: 'x',
        source: 'ai',
        status: 'ready',
        persistMeta: null,
        flowchart: {
          nodeId: 'b',
          nodeTitle: '分析架构',
          parentId: 'a',
          branchType: 'trunk',
          importance: 'high',
          dropFromChart: false,
          intentKey: 'arch',
        },
      },
    });
    expect(arc).toBe('问候 → 分析架构');
  });
});

function makeExp(id: string, question: string, status: Exploration['status']): Exploration {
  return {
    id,
    question,
    startedAt: 1,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [],
  };
}
