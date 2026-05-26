import type { SessionBindingMode } from './session-binding-policy';
import type { ObserverSessionSnapshot } from '../../data/protocol/observer-protocol';
import { buildPickerBaselineMtimes } from '../../data/session/session-discovery';
import {
  FileSessionRepository,
  type SessionBindingContext,
  type SessionRepository,
} from '../../data/session/repository';
import { createLogger } from '../../utils/logger';

const log = createLogger('session');

export interface ObserverSessionPollInput {
  cwd: string;
  bindingMode: SessionBindingMode;
  explicitSessionId?: string;
}

export interface ObserverSessionService {
  poll(input: ObserverSessionPollInput): Promise<ObserverSessionSnapshot | null>;
  getPickerPinnedSessionId(): string | undefined;
  isAwaitingPickerSelection(): boolean;
  resetForBindingChange(): void;
}

export class PollingObserverSessionService implements ObserverSessionService {
  private previous: { mtimeMs: number; sessionPath: string } | null = null;
  private lastSnapshot: ObserverSessionSnapshot | null = null;
  private baselineMtimes: Map<string, number> | null = null;
  private pickerPinnedSessionId: string | undefined;
  private flowStartedAtMs = Date.now();

  constructor(private readonly sessions: SessionRepository = new FileSessionRepository()) {}

  resetForBindingChange(): void {
    this.previous = null;
    this.lastSnapshot = null;
    this.baselineMtimes = null;
    this.pickerPinnedSessionId = undefined;
    this.flowStartedAtMs = Date.now();
    log.debug('observer session service reset for binding change');
  }

  getPickerPinnedSessionId(): string | undefined {
    return this.pickerPinnedSessionId;
  }

  isAwaitingPickerSelection(): boolean {
    return !this.pickerPinnedSessionId
      && Date.now() - this.flowStartedAtMs < 30_000;
  }

  async poll(input: ObserverSessionPollInput): Promise<ObserverSessionSnapshot | null> {
    if (input.bindingMode === 'continue_picker' && !this.baselineMtimes) {
      this.baselineMtimes = buildPickerBaselineMtimes(input.cwd);
    }

    const explicitSessionId = input.bindingMode === 'continue' || input.bindingMode === 'bind_specific'
      ? input.explicitSessionId
      : undefined;

    const binding: SessionBindingContext = {
      mode: input.bindingMode,
      explicitSessionId,
      pinnedSessionId: this.pickerPinnedSessionId,
      baselineMtimes: this.baselineMtimes ?? undefined,
    };

    const active = await this.sessions.resolveActiveSession({ cwd: input.cwd, binding });
    if (!active) {
      if (this.shouldClearSnapshotOnMiss(input.bindingMode)) {
        log.debug('poll miss cleared snapshot', { bindingMode: input.bindingMode });
        this.previous = null;
        this.lastSnapshot = null;
        return null;
      }
      return this.lastSnapshot;
    }

    if (input.bindingMode === 'continue_picker' && active.source === 'delta') {
      this.pickerPinnedSessionId = active.sessionId;
      log.info('picker pinned session', { sessionId: active.sessionId });
    }

    if (
      this.lastSnapshot
      && this.lastSnapshot.sessionId !== active.sessionId
    ) {
      log.info('session switched', {
        fromSessionId: this.lastSnapshot.sessionId,
        toSessionId: active.sessionId,
        source: active.source,
      });
      this.previous = null;
      this.lastSnapshot = null;
    }

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

  private shouldClearSnapshotOnMiss(mode: SessionBindingMode): boolean {
    return mode === 'bind_specific'
      || mode === 'continue'
      || mode === 'continue_picker';
  }
}
