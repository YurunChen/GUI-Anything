import { describe, expect, it } from 'bun:test';

import {
  consumeCompletedExplorationNotifications,
  consumeNewKnowledgeNotifications,
  initialNotifiedExplorationIds,
  initialNotifiedKnowledgeIds,
} from './useNotification';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import { SUMMARY_REASON_LIVE_PREVIEW } from '../../../data/protocol/summary-provenance';

describe('knowledge notification tracking', () => {
  it('does not consume pending summaries during initial hydration', () => {
    const notified = initialNotifiedKnowledgeIds([
      { id: 'pending', status: 'pending', persistMeta: { should_persist: true } },
      { id: 'ready', status: 'ready', persistMeta: { should_persist: true } },
    ]);

    expect(notified.has('ready')).toBe(true);
    expect(notified.has('pending')).toBe(false);
  });

  it('notifies once when a pending summary becomes persistable', () => {
    const notified = initialNotifiedKnowledgeIds([
      { id: 'knowledge-1', status: 'pending', persistMeta: { should_persist: true } },
    ]);

    const first = consumeNewKnowledgeNotifications([
      { id: 'knowledge-1', status: 'ready', persistMeta: { should_persist: true } },
    ], notified);
    const second = consumeNewKnowledgeNotifications([
      { id: 'knowledge-1', status: 'ready', persistMeta: { should_persist: true } },
    ], notified);

    expect(first.map((item) => item.id)).toEqual(['knowledge-1']);
    expect(second).toEqual([]);
  });

  it('ignores ready summaries that are not persistable', () => {
    const notified = new Set<string>();
    const notifications = consumeNewKnowledgeNotifications([
      { id: 'skip', status: 'ready', persistMeta: { should_persist: false } },
      { id: 'missing-meta', status: 'ready' },
    ], notified);

    expect(notifications).toEqual([]);
    expect([...notified]).toEqual([]);
  });
});

describe('completed exploration notification tracking', () => {
  it('starts after the currently visible explorations', () => {
    const notified = initialNotifiedExplorationIds([
      exploration('exp-1', 'complete'),
      exploration('exp-2', 'running'),
    ]);

    const notifications = consumeCompletedExplorationNotifications([
      exploration('exp-1', 'complete'),
      exploration('exp-2', 'complete'),
      exploration('exp-3', 'complete'),
    ], notified, {
      's:exp-1': summary('exp-1', 'ready'),
      's:exp-2': summary('exp-2', 'ready'),
      's:exp-3': summary('exp-3', 'ready'),
    });

    expect(notifications.map((item) => item.exploration.id)).toEqual(['exp-3']);
    expect([...notified].sort()).toEqual(['exp-1', 'exp-2', 'exp-3']);
  });

  it('waits until the completed exploration summary is no longer pending', () => {
    const notified = new Set<string>();
    const pending = consumeCompletedExplorationNotifications([
      exploration('exp-1', 'complete'),
    ], notified, {
      's:exp-1': summary('exp-1', 'pending'),
    });
    const ready = consumeCompletedExplorationNotifications([
      exploration('exp-1', 'complete'),
    ], notified, {
      's:exp-1': summary('exp-1', 'ready'),
    });

    expect(pending).toEqual([]);
    expect(ready.map((item) => item.exploration.id)).toEqual(['exp-1']);
  });

  it('waits for the real summary instead of sending the live preview digest', () => {
    const notified = new Set<string>();
    const livePreview = consumeCompletedExplorationNotifications([
      exploration('exp-1', 'complete'),
    ], notified, {
      's:exp-1': {
        ...summary('exp-1', 'ready'),
        source: 'excerpt',
        reason: SUMMARY_REASON_LIVE_PREVIEW,
      },
    }, {
      'exp-1': true,
    });

    const stillPreview = consumeCompletedExplorationNotifications([
      exploration('exp-1', 'complete'),
    ], notified, {
      's:exp-1': {
        ...summary('exp-1', 'ready'),
        source: 'excerpt',
        reason: SUMMARY_REASON_LIVE_PREVIEW,
      },
    }, {
      'exp-1': false,
    });

    const realSummary = consumeCompletedExplorationNotifications([
      exploration('exp-1', 'complete'),
    ], notified, {
      's:exp-1': {
        ...summary('exp-1', 'ready'),
        source: 'ai',
      },
    }, {
      'exp-1': false,
    });

    expect(livePreview).toEqual([]);
    expect(stillPreview).toEqual([]);
    expect(realSummary.map((item) => item.exploration.id)).toEqual(['exp-1']);
    expect([...notified]).toEqual(['exp-1']);
  });
});

function exploration(id: string, status: Exploration['status']): Exploration {
  return {
    id,
    question: `question ${id}`,
    startedAt: 1,
    endedAt: status === 'running' ? undefined : 2,
    status,
    currentPhase: 'execute',
    phaseSeen: { explore: true, execute: true, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [],
  };
}

function summary(explorationId: string, status: string) {
  return {
    id: `s:${explorationId}`,
    explorationId,
    status,
    text: `summary ${explorationId}`,
    persistMeta: null,
  };
}
