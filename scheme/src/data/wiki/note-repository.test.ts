import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileNoteRepository } from './note-repository';

describe('FileNoteRepository', () => {
  let tmpRoot = '';
  let repo: FileNoteRepository;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-note-repo-'));
    repo = new FileNoteRepository({ wikiRoot: tmpRoot });
  });

  afterEach(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('create + findById + listRecent', () => {
    const created = repo.create({ text: 'First inspiration\nbody', sessionId: 'sess-1' });
    expect(created.ok).toBe(true);
    expect(created.id).toMatch(/^N\d{3}$/);
    const noteId = created.id!;

    const found = repo.findById(noteId);
    expect(found?.body).toContain('First inspiration');
    expect(found?.sessionId).toBe('sess-1');

    const recent = repo.listRecent(5);
    expect(recent.length).toBe(1);
    expect(recent[0].id).toBe(noteId);
  });

  it('update rewrites entry in daily file', () => {
    const created = repo.create({ text: 'Original title', sessionId: 's' });
    const updated = repo.update(created.id!, 'Updated title\nnew body');
    expect(updated.ok).toBe(true);

    const found = repo.findById(created.id!);
    expect(found?.title).toBe('Updated title');
    expect(found?.body).toContain('new body');
  });

  it('delete removes entry', () => {
    const created = repo.create({ text: 'To delete', sessionId: 's' });
    expect(repo.delete(created.id!)).toBe(true);
    expect(repo.findById(created.id!)).toBeNull();
    expect(repo.listRecent(5)).toHaveLength(0);
  });
});
