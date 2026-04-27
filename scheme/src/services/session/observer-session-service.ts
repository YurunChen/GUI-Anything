import type { ObserverSessionSnapshot } from '../../data/protocol/observer-protocol';
import {
  FileSessionRepository,
  type SessionRepository,
} from '../../data/session/repository';

export interface ObserverSessionService {
  poll(input: {
    cwd: string;
    explicitSessionId?: string;
  }): Promise<ObserverSessionSnapshot | null>;
}

export class PollingObserverSessionService implements ObserverSessionService {
  private previous: { mtimeMs: number; sessionPath: string } | null = null;
  private lastSnapshot: ObserverSessionSnapshot | null = null;

  constructor(private readonly sessions: SessionRepository = new FileSessionRepository()) {}

  async poll(input: {
    cwd: string;
    explicitSessionId?: string;
  }): Promise<ObserverSessionSnapshot | null> {
    const active = await this.sessions.resolveActiveSession(input);
    if (!active) return this.lastSnapshot;
    const result = await this.sessions.readSnapshot({
      sessionPath: active.sessionPath,
      previous: this.previous,
    });
    this.previous = { mtimeMs: result.mtimeMs, sessionPath: active.sessionPath };
    if (!result.changed || !result.snapshot) return this.lastSnapshot;
    this.lastSnapshot = {
      ...result.snapshot,
      sessionId: active.sessionId,
    };
    return this.lastSnapshot;
  }
}
