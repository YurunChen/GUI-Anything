import { describe, expect, it } from 'bun:test';
import type { Exploration, SummaryItem } from '../../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../../data/protocol/observer-protocol';
import { buildLiveIntentChrome } from './intent-chrome';

describe('intent chrome', () => {
  it('prefers latest non-greeting flowchart over stale session intent', () => {
    const explorations: Exploration[] = [
      {
        id: 'exp_1',
        question: 'hello',
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
        question: 'analyze project',
        startedAt: 3,
        endedAt: 4,
        status: 'complete',
        currentPhase: 'idle',
        phaseSeen: { explore: false, execute: false, verify: false },
        errorCounts: { tool: 0, system: 0, result: 0 },
        nodes: [],
      },
    ];
    const summaryItems: Record<string, SummaryItem> = {
      [makeSessionScopedId('s1', 'exp_1')]: {
        id: makeSessionScopedId('s1', 'exp_1'),
        sessionId: 's1',
        explorationId: 'exp_1',
        text: 'hi',
        source: 'ai',
        status: 'ready',
        persistMeta: null,
        flowchart: {
          nodeId: 'greeting',
          nodeTitle: 'Awaiting task',
          parentId: null,
          branchType: 'trunk',
          importance: 'low',
          dropFromChart: true,
          intentKey: 'greeting',
          titleDelta: 'idle',
        },
      },
      [makeSessionScopedId('s1', 'exp_2')]: {
        id: makeSessionScopedId('s1', 'exp_2'),
        sessionId: 's1',
        explorationId: 'exp_2',
        text: 'summary',
        source: 'ai',
        status: 'ready',
        persistMeta: null,
        flowchart: {
          nodeId: 'n2',
          nodeTitle: '项目结构分析',
          parentId: null,
          branchType: 'trunk',
          importance: 'medium',
          dropFromChart: false,
          intentKey: 'project_design',
          titleDelta: 'continue',
        },
      },
    };
    const view = buildLiveIntentChrome({
      sessionIntent: {
        sessionId: 's1',
        revision: 1,
        intentKey: 'greeting',
        nodeTitle: 'Awaiting task',
        parentIntentKey: null,
        phase: 'idle',
        history: [],
        updatedAt: 1,
      },
      explorations,
      summaryItems,
    });
    expect(view).toEqual({ title: '项目结构分析', intentKey: 'project_design' });
  });

  it('falls back to session intent title when no flowchart', () => {
    const view = buildLiveIntentChrome({
      sessionIntent: {
        sessionId: 's1',
        revision: 1,
        intentKey: 'project_design',
        nodeTitle: 'Session title',
        parentIntentKey: null,
        phase: 'active',
        history: [],
        updatedAt: 1,
      },
      explorations: [],
    });
    expect(view).toEqual({ title: 'Session title', intentKey: 'project_design' });
  });
});
