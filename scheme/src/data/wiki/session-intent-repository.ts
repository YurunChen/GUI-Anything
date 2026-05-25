import * as fs from 'node:fs';
import type { SessionId, SessionIntentState } from '../protocol/observer-protocol';
import { ensureDir, sessionIntentPath } from './wiki-data-layout';

export interface SessionIntentRepository {
  load(sessionId: SessionId): SessionIntentState | null;
  save(state: SessionIntentState): void;
}

export class FileSessionIntentRepository implements SessionIntentRepository {
  load(sessionId: SessionId): SessionIntentState | null {
    const filePath = sessionIntentPath(sessionId);
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as SessionIntentState;
      if (parsed.sessionId !== sessionId) {
        return { ...parsed, sessionId };
      }
      return parsed;
    } catch {
      return null;
    }
  }

  save(state: SessionIntentState): void {
    const filePath = sessionIntentPath(state.sessionId);
    ensureDir(filePath.slice(0, filePath.lastIndexOf('/')));
    fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

export const defaultSessionIntentRepository = new FileSessionIntentRepository();
