import { describe, expect, it } from 'bun:test';
import type { Exploration } from '../../data/protocol/observer-protocol';
import {
  buildSessionBanner,
  deriveSessionPresentationPolicy,
} from './session-presentation-policy';
import { resolveSessionBindingIntent } from './session-binding-policy';

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

describe('session-presentation-policy', () => {
  it('replay mode disables regen and enables stale + excerpt', () => {
    const intent = resolveSessionBindingIntent({ resumeModeRaw: 'specific' });
    const policy = deriveSessionPresentationPolicy(intent);
    expect(policy.mode).toBe('replay');
    expect(policy.allowSummaryRegen).toBe(false);
    expect(policy.preserveStaleCache).toBe(true);
    expect(policy.fillExcerptFallback).toBe(true);
  });

  it('live mode allows regen', () => {
    const intent = resolveSessionBindingIntent({ resumeModeRaw: 'bind_specific' });
    const policy = deriveSessionPresentationPolicy(intent);
    expect(policy.mode).toBe('live');
    expect(policy.allowSummaryRegen).toBe(true);
    expect(policy.preserveStaleCache).toBe(false);
  });

  it('buildSessionBanner reports excerpt count in replay', () => {
    const presentation = deriveSessionPresentationPolicy(
      resolveSessionBindingIntent({ resumeModeRaw: 'specific' }),
    );
    const banner = buildSessionBanner({
      presentation,
      explorations: [makeExploration('exp_1')],
      summaryItems: {
        'sid:exp_1': {
          id: 'sid:exp_1',
          sessionId: 'sid',
          explorationId: 'exp_1',
          text: 'excerpt text',
          source: 'excerpt',
          status: 'ready',
          persistMeta: null,
        },
      },
    });
    expect(banner.modeLine).toBe('replay');
    expect(banner.detailLine).toContain('1 excerpt');
  });
});
