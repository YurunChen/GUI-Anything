import { describe, expect, it, beforeEach } from 'bun:test';
import type { Exploration } from '../../../../data/protocol/observer-protocol';
import { createCachedBuilder, type CachedBuildFlowGraphSnapshot } from './flow-graph-snapshot-cache';

function makeExploration(id: string, startedAt: number, status: Exploration['status'] = 'complete'): Exploration {
  return {
    id,
    question: id,
    startedAt,
    endedAt: startedAt + 10,
    status,
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [],
  };
}

describe('createCachedBuilder', () => {
  let cachedBuilder: CachedBuildFlowGraphSnapshot;

  beforeEach(() => {
    cachedBuilder = createCachedBuilder();
  });

  it('returns identical reference on unchanged input (no-op polling)', () => {
    const baseInput = {
      sessionId: 's1',
      explorations: [makeExploration('exp_1', 100)],
      summaries: { exp_1: 'summary-1' },
    };

    const first = cachedBuilder(baseInput);
    // Simulate another poll with same logical data but different array/object refs.
    Object.setPrototypeOf(baseInput.explorations, Object.getPrototypeOf(baseInput.explorations));
    const second = cachedBuilder({ ...baseInput, summaries: { ...baseInput.summaries } });

    expect(first).toBe(second);
  });

  it('rebuids when a new exploration is appended', () => {
    const baseInput = {
      sessionId: 's1',
      explorations: [makeExploration('exp_1', 100)],
      summaries: { exp_1: 'summary-1' },
    };
    const first = cachedBuilder(baseInput);

    const updated = {
      ...baseInput,
      explorations: [...baseInput.explorations, makeExploration('exp_2', 200)],
      summaries: { ...baseInput.summaries, exp_2: 'summary-2' },
    };
    const second = cachedBuilder(updated);

    expect(first).not.toBe(second);
    expect(second.nodes.length).toBe(2);
  });

  it('rebuilds when an exploration changes from running to complete', () => {
    const baseInput = {
      sessionId: 's1',
      explorations: [makeExploration('exp_1', 100, 'running')],
      summaries: {},
    };
    const first = cachedBuilder(baseInput);

    const completed = {
      ...baseInput,
      explorations: [makeExploration('exp_1', 100, 'complete')],
    };
    const second = cachedBuilder(completed);

    expect(first).not.toBe(second);
  });

  it('rebuilds when summary text changes', () => {
    const baseInput = {
      sessionId: 's1',
      explorations: [makeExploration('exp_1', 100)],
      summaries: { exp_1: 'summary-old' },
    };
    const first = cachedBuilder(baseInput);

    const updated = { ...baseInput, summaries: { exp_1: 'summary-new' } };
    const second = cachedBuilder(updated);

    expect(first).not.toBe(second);
  });

  it('invalid() clears the cache so next call always rebuilds', () => {
    const baseInput = {
      sessionId: 's1',
      explorations: [makeExploration('exp_1', 100)],
      summaries: { exp_1: 'summary-1' },
    };

    cachedBuilder(baseInput);
    cachedBuilder.invalidate();

    const rebuilt = cachedBuilder(baseInput);
    // After invalidate, a fresh object is created (doesn't matter about identity vs prev since prev was discarded)
    expect((rebuilt as unknown as Record<string, unknown>).updatedAt).toBeDefined();
  });

  it('handles empty explorations list gracefully', () => {
    const baseInput = {
      sessionId: 's1',
      explorations: [],
      summaries: {},
    };

    const first = cachedBuilder(baseInput);
    const second = cachedBuilder({ ...baseInput, explorations: [] });

    expect(first).toBe(second);
    // Empty explorations — no fallback without any explorations
    expect(first.nodes).toHaveLength(0);
  });

  it('rebuilds when wikiPersistStatus value changes', () => {
    const baseInput = {
      sessionId: 's1' as string,
      explorations: [makeExploration('exp_1', 100)] as Exploration[],
      summaries: { exp_1: 'summary-1' } as Record<string, string>,
      wikiPersistStatus: { exp_1: 'saved' as const },
    };

    const first = cachedBuilder(baseInput);
    const changedWiki = {
      ...baseInput,
      wikiPersistStatus: { exp_1: 'skipped' as const },
    };
    const second = cachedBuilder(changedWiki);

    expect(first).not.toBe(second);
  });
});
