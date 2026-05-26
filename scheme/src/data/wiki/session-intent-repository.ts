import type { SessionId, SessionIntentState } from '../protocol/observer-protocol';
import {
  defaultSessionBundleRepository,
  type SessionBundleRepository,
} from './session-bundle-repository';

export interface SessionIntentRepository {
  load(sessionId: SessionId): SessionIntentState | null;
  save(state: SessionIntentState): void;
}

export class FileSessionIntentRepository implements SessionIntentRepository {
  constructor(private readonly bundleRepo: SessionBundleRepository = defaultSessionBundleRepository()) {}

  load(sessionId: SessionId): SessionIntentState | null {
    return this.bundleRepo.load(sessionId)?.session.intent ?? null;
  }

  save(state: SessionIntentState): void {
    this.bundleRepo.patch(state.sessionId, (bundle) => {
      bundle.session.intent = state;
    });
  }
}

export const defaultSessionIntentRepository = new FileSessionIntentRepository();
