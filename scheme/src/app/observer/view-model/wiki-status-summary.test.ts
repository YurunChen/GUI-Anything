import { describe, expect, it } from 'bun:test';
import { countWikiStatuses, formatWikiStatusLine } from './wiki-status-summary';

describe('wiki status summary', () => {
  it('formats only non-zero buckets', () => {
    const line = formatWikiStatusLine(
      countWikiStatuses({
        exp_1: 'saved',
        exp_2: 'skipped',
        exp_3: 'pending',
      }),
      {
        saved: 'saved',
        updated: 'updated',
        pending: 'pending',
        skipped: 'skipped',
        failed: 'failed',
      },
    );
    expect(line).toBe('wiki 1 saved · 1 pending · 1 skipped');
  });

  it('returns null when no wiki activity', () => {
    expect(formatWikiStatusLine(
      countWikiStatuses({}),
      { saved: 's', updated: 'u', pending: 'p', skipped: 'k', failed: 'f' },
    )).toBeNull();
  });
});
