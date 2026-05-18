import { describe, expect, it } from 'bun:test';
import { shouldGenerateMissingSummaries } from './useExplorationSummaries';

describe('useExplorationSummaries helpers', () => {
  it('disables regeneration when replay policy is strict', () => {
    const result = shouldGenerateMissingSummaries({
      allowRegen: false,
      sessionId: 'sid',
      wikiHydratedSessionId: 'sid',
      sessionPath: '/tmp/sid.jsonl',
    });
    expect(result).toBe(false);
  });

  it('requires session, hydration, and session path to regenerate', () => {
    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: '',
      wikiHydratedSessionId: '',
      sessionPath: '/tmp/sid.jsonl',
    })).toBe(false);

    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: 'sid',
      wikiHydratedSessionId: '',
      sessionPath: '/tmp/sid.jsonl',
    })).toBe(false);

    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: 'sid',
      wikiHydratedSessionId: 'sid',
      sessionPath: '',
    })).toBe(false);

    expect(shouldGenerateMissingSummaries({
      allowRegen: true,
      sessionId: 'sid',
      wikiHydratedSessionId: 'sid',
      sessionPath: '/tmp/sid.jsonl',
    })).toBe(true);
  });
});
