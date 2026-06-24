import { describe, expect, it } from 'bun:test';

// Badge labels are localized; pin to English so assertions don't depend on the
// dev machine's LANG (resolveObserverLocale reads FLOW_LOCALE first).
process.env.FLOW_LOCALE = 'en';

import { formatWikiPersistBadge } from './StatusBadges';

describe('formatWikiPersistBadge', () => {
  it('groups wiki prefix, entry id, and status without dot separators', () => {
    const badge = formatWikiPersistBadge('saved', undefined, { targetId: 'C001' });
    expect(badge.text).toBe('wiki C001 saved');
    expect(badge.targetId).toBe('C001');
    expect(badge.statusText).toBe('saved');
  });

  it('appends turn count in parentheses after status', () => {
    const badge = formatWikiPersistBadge('updated', undefined, {
      targetId: 'C001',
      turnCount: 3,
    });
    expect(badge.text).toBe('wiki C001 updated (3 turns)');
  });

  it('falls back to wiki-only label when no entry id', () => {
    const badge = formatWikiPersistBadge('skipped', 'no new facts');
    expect(badge.text).toBe('wiki skipped (no new facts)');
    expect(badge.targetId).toBeUndefined();
  });
});
