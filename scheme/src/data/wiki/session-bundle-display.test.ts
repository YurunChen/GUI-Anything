import { describe, expect, it } from 'bun:test';
import { bundleHasDisplayData, createEmptyBundle } from './session-bundle-mappers';

describe('bundleHasDisplayData', () => {
  it('returns false for missing or empty bundle', () => {
    expect(bundleHasDisplayData(null)).toBe(false);
    expect(bundleHasDisplayData(createEmptyBundle({
      sessionId: 's1',
      jsonlPath: '/tmp/s.jsonl',
      jsonlMtime: 1,
    }))).toBe(false);
  });

  it('returns true when exploration summary exists', () => {
    const bundle = createEmptyBundle({
      sessionId: 's1',
      jsonlPath: '/tmp/s.jsonl',
      jsonlMtime: 1,
    });
    bundle.explorations.exp_1 = {
      explorationId: 'exp_1',
      question: 'q',
      summary: { text: 'hello', source: 'ai', status: 'ready', savedAt: 1 },
      retrieval: null,
      write: null,
    };
    expect(bundleHasDisplayData(bundle)).toBe(true);
  });
});
