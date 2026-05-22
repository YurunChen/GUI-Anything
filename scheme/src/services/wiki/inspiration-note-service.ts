import {
  FileNoteRepository,
  type CreateDailyNoteResult,
  type DailyNoteRecord,
  type NoteRepository,
} from '../../data/wiki/note-repository';
import type { InspirationRecord } from '../../data/protocol/observer-protocol';

export interface SaveInspirationResult {
  saved: boolean;
  id?: string;
  title?: string;
  path?: string;
  reason?: string;
}

export interface InspirationNoteService {
  saveInspiration(text: string, sessionId?: string): SaveInspirationResult;
  listRecentInspirations(limit?: number): InspirationRecord[];
  findInspiration(id: string): InspirationRecord | null;
  updateInspiration(id: string, text: string): SaveInspirationResult;
  deleteInspiration(id: string): boolean;
}

function toSaveResult(result: CreateDailyNoteResult): SaveInspirationResult {
  if (!result.ok) {
    return { saved: false, reason: result.reason };
  }
  return {
    saved: true,
    id: result.id,
    title: result.title,
    path: result.path,
  };
}

export class DefaultInspirationNoteService implements InspirationNoteService {
  constructor(private readonly repository: NoteRepository = new FileNoteRepository()) {}

  saveInspiration(text: string, sessionId?: string): SaveInspirationResult {
    return toSaveResult(this.repository.create({ text, sessionId }));
  }

  listRecentInspirations(limit = 6): InspirationRecord[] {
    return this.repository.listRecent(limit);
  }

  findInspiration(id: string): InspirationRecord | null {
    return this.repository.findById(id);
  }

  updateInspiration(id: string, text: string): SaveInspirationResult {
    return toSaveResult(this.repository.update(id, text));
  }

  deleteInspiration(id: string): boolean {
    return this.repository.delete(id);
  }
}
