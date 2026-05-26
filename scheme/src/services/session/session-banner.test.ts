import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../data/protocol/observer-protocol';
import { resolveSessionBindingIntent } from './session-binding-policy';
import { deriveSessionRuntime } from './session-runtime-policy';
import { buildSessionBanner } from './session-banner';

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

describe('buildSessionBanner', () => {
  it('reports excerpt count in replay', () => {
    const runtime = deriveSessionRuntime({
      intent: resolveSessionBindingIntent({ resumeModeRaw: 'continue' }),
      sessionId: 'sid',
      sessionBound: true,
      explorations: [makeExploration('exp_1')],
      summaryItems: {
        'sid:exp_1': {
          id: 'sid:exp_1',
          sessionId: 'sid',
          explorationId: 'exp_1',
          text: 'excerpt text',
          source: 'fallback',
          status: 'ready',
          reason: 'timeline_excerpt',
          persistMeta: null,
        },
      },
      wikiBundleHasData: true,
      explorationCount: 1,
      summaryCount: 1,
      flowchartHintCount: 0,
    });
    const banner = buildSessionBanner({
      presentation: runtime.presentation,
      explorations: [makeExploration('exp_1')],
      summaryItems: {
        'sid:exp_1': {
          id: 'sid:exp_1',
          sessionId: 'sid',
          explorationId: 'exp_1',
          text: 'excerpt text',
          source: 'fallback',
          status: 'ready',
          reason: 'timeline_excerpt',
          persistMeta: null,
        },
      },
    });
    expect(banner.modeLine).toBe('replay');
    expect(banner.detailLine).toContain('1 excerpt');
  });
});
