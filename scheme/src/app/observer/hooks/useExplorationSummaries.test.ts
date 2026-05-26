import { describe, expect, it } from 'bun:test';
import type { Exploration, SummaryItem } from '../../../data/protocol/observer-protocol';
import {
  buildGenerateTriggerKey,
  hasMissingSummaries,
  shouldGenerateMissingSummaries,
} from './useExplorationSummaries';

describe('useExplorationSummaries helpers', () => {
  it('disables regeneration when replay policy is strict', () => {
    expect(shouldGenerateMissingSummaries({
      allowRegen: false,
      sessionId: 'sid',
      summariesReadyKey: 'sid|/tmp/sid.jsonl',
      sessionPath: '/tmp/sid.jsonl',
    })).toBe(false);
  });

  it('requires session, hydration key, and session path to regenerate', () => {
    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: '',
      summariesReadyKey: '',
      sessionPath: '/tmp/sid.jsonl',
    })).toBe(false);

    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: 'sid',
      summariesReadyKey: '',
      sessionPath: '/tmp/sid.jsonl',
    })).toBe(false);

    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: 'sid',
      summariesReadyKey: 'sid|/tmp/sid.jsonl',
      sessionPath: '',
    })).toBe(false);

    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: 'sid',
      summariesReadyKey: 'sid|/tmp/sid.jsonl',
      sessionPath: '/tmp/sid.jsonl',
    })).toBe(true);
  });

  it('hasMissingSummaries is false when every complete exploration is ready', () => {
    const explorations: Exploration[] = [{
      id: 'exp_1',
      question: 'q',
      startedAt: 1,
      endedAt: 2,
      status: 'complete',
      currentPhase: 'idle',
      phaseSeen: { explore: false, execute: false, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
      nodes: [{ id: 'n', timestamp: 1, type: 'tool', status: 'ok', label: 'x' }],
    }];
    const items: Record<string, SummaryItem> = {
      'sid:exp_1': {
        id: 'sid:exp_1',
        sessionId: 'sid',
        explorationId: 'exp_1',
        text: 'done',
        source: 'cache',
        status: 'ready',
        persistMeta: null,
      },
    };
    expect(hasMissingSummaries('sid', explorations, items)).toBe(false);
    expect(hasMissingSummaries('sid', explorations, {})).toBe(true);
    expect(hasMissingSummaries('sid', explorations, {
      'sid:exp_1': {
        id: 'sid:exp_1',
        sessionId: 'sid',
        explorationId: 'exp_1',
        text: '  ',
        source: 'cache',
        status: 'ready',
        persistMeta: null,
      },
    })).toBe(true);
  });

  it('buildGenerateTriggerKey ignores running explorations and node churn', () => {
    const running: Exploration = {
      id: 'exp_1',
      question: 'q',
      startedAt: 1,
      status: 'running',
      currentPhase: 'idle',
      phaseSeen: { explore: false, execute: false, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
      nodes: [{ id: 'n', timestamp: 1, type: 'tool', status: 'ok', label: 'x' }],
    };
    expect(buildGenerateTriggerKey([running])).toBe('');

    const complete: Exploration = { ...running, status: 'complete', endedAt: 2 };
    expect(buildGenerateTriggerKey([complete])).toBe('exp_1');
    expect(buildGenerateTriggerKey([{ ...complete, nodes: [...complete.nodes, { id: 'n2', timestamp: 2, type: 'tool', status: 'ok', label: 'y' }] }])).toBe('exp_1');
  });
});
