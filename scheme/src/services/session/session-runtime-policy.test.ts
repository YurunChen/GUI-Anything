import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../data/protocol/observer-protocol';
import { resolveSessionBindingIntent } from './session-binding-policy';
import {
  countMissingSummaries,
  deriveSessionRuntime,
  hasMissingSummaries,
  resolveObserverPhase,
} from './session-runtime-policy';

function makeExploration(id: string): Exploration {
  return {
    id,
    question: 'q',
    startedAt: 1,
    endedAt: 2,
    status: 'complete',
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [{ id: 'n', timestamp: 1, type: 'tool', status: 'ok', label: 'x' }],
  };
}

describe('session-runtime-policy', () => {
  it('phase matrix: continue × wiki × missing', () => {
    const intent = resolveSessionBindingIntent({ resumeModeRaw: 'continue' });
    expect(resolveObserverPhase(intent, true, false)).toBe('replay');
    expect(resolveObserverPhase(intent, true, true)).toBe('live');
    expect(resolveObserverPhase(intent, false, true)).toBe('live');
    expect(resolveObserverPhase(intent, false, false)).toBe('live');
  });

  it('new session is always live', () => {
    const intent = resolveSessionBindingIntent({ resumeModeRaw: 'bind_specific' });
    expect(resolveObserverPhase(intent, true, false)).toBe('live');
  });

  it('deriveSessionRuntime unifies visibility and summary policy', () => {
    const intent = resolveSessionBindingIntent({ resumeModeRaw: 'continue_picker' });
    const hidden = deriveSessionRuntime({
      intent,
      sessionId: '',
      sessionBound: false,
      explorations: [],
      summaryItems: {},
      wikiBundleHasData: false,
      explorationCount: 0,
      summaryCount: 0,
      flowchartHintCount: 0,
    });
    expect(hidden.visibility).toBe('hide');
    expect(hidden.phase).toBe('live');
    expect(hidden.presentation.allowSummaryRegen).toBe(true);

    const visible = deriveSessionRuntime({
      intent,
      sessionId: 'sid',
      sessionBound: true,
      explorations: [makeExploration('exp_1')],
      summaryItems: {},
      wikiBundleHasData: false,
      explorationCount: 1,
      summaryCount: 0,
      flowchartHintCount: 0,
    });
    expect(visible.visibility).toBe('show');
    expect(visible.hasMissingSummaries).toBe(true);
    expect(visible.presentation.allowSummaryRegen).toBe(true);
  });

  it('replay when continue + full wiki coverage', () => {
    const intent = resolveSessionBindingIntent({
      resumeModeRaw: 'continue',
      explicitSessionId: 'sid',
    });
    const runtime = deriveSessionRuntime({
      intent,
      sessionId: 'sid',
      sessionBound: true,
      explorations: [makeExploration('exp_1')],
      summaryItems: {
        'sid:exp_1': {
          id: 'sid:exp_1',
          sessionId: 'sid',
          explorationId: 'exp_1',
          text: 'cached',
          source: 'cache',
          status: 'ready',
          persistMeta: null,
        },
      },
      wikiBundleHasData: true,
      explorationCount: 1,
      summaryCount: 1,
      flowchartHintCount: 0,
    });
    expect(runtime.phase).toBe('replay');
    expect(runtime.presentation.allowSummaryRegen).toBe(false);
    expect(runtime.presentation.fillExcerptFallback).toBe(true);
    expect(runtime.hasMissingSummaries).toBe(false);
  });

  it('counts only complete explorations without ready summaries', () => {
    expect(countMissingSummaries('sid', [
      makeExploration('exp_1'),
      makeExploration('exp_2'),
      { ...makeExploration('exp_3'), status: 'running', endedAt: undefined },
    ], {
      'sid:exp_1': {
        id: 'sid:exp_1',
        sessionId: 'sid',
        explorationId: 'exp_1',
        text: 'cached',
        source: 'cache',
        status: 'ready',
        persistMeta: null,
      },
    })).toBe(1);
  });
});
