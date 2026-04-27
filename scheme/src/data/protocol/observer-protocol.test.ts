import { describe, expect, it } from 'bun:test';
import { makeSessionScopedId, splitSessionScopedId } from './observer-protocol';

describe('observer protocol ids', () => {
  it('creates and splits stable session-scoped ids', () => {
    const id = makeSessionScopedId('session-a', 'exp_1');

    expect(id).toBe('session-a:exp_1');
    expect(splitSessionScopedId(id)).toEqual({
      sessionId: 'session-a',
      explorationId: 'exp_1',
    });
  });

  it('rejects empty id parts', () => {
    expect(() => makeSessionScopedId('', 'exp_1')).toThrow();
    expect(() => makeSessionScopedId('session-a', '')).toThrow();
  });
});
