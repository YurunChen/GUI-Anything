import { describe, expect, it } from 'bun:test';
import type { SessionBindingContext } from '../../data/session/repository';
import { PollingObserverSessionService } from './observer-session-service';

class StubSessionRepository {
  resolveCalls = 0;

  async resolveActiveSession(_input: { cwd: string; binding: SessionBindingContext }) {
    this.resolveCalls += 1;
    return null;
  }

  async readSnapshot() {
    return { changed: false, mtimeMs: 0 };
  }
}

describe('PollingObserverSessionService', () => {
  it('clears stale snapshot when pinned binding misses jsonl', async () => {
    const repo = new StubSessionRepository();
    const service = new PollingObserverSessionService(repo);

    const first = await service.poll({
      cwd: '/tmp',
      bindingMode: 'bind_specific',
      explicitSessionId: 'missing-id',
    });
    expect(first).toBeNull();

    const second = await service.poll({
      cwd: '/tmp',
      bindingMode: 'bind_specific',
      explicitSessionId: 'missing-id',
    });
    expect(second).toBeNull();
    expect(repo.resolveCalls).toBe(2);
  });
});
