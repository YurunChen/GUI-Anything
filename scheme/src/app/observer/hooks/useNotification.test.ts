import { describe, expect, it } from 'bun:test';

import {
  consumeNewKnowledgeNotifications,
  initialNotifiedKnowledgeIds,
} from './useNotification';

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
