/**
 * Daily note repository — CRUD for wiki/notes/{YYYY-MM-DD}.md
 * Append-only file format; update/delete rewrite the daily file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveWikiRoot } from '../env';
import { allocateSequentialId } from './id-allocation';
import {
  ensureDir,
  notesDailyFilePath,
  wikiNotesDir,
} from './wiki-data-layout';

export interface DailyNoteRecord {
  id: string;
  title: string;
  created: string;
  path: string;
  body?: string;
  sessionId?: string;
  dateKey?: string;
}

export interface CreateDailyNoteInput {
  text: string;
  sessionId?: string;
}

export interface CreateDailyNoteResult {
  ok: boolean;
  id?: string;
  title?: string;
  path?: string;
  reason?: string;
}

export interface NoteRepository {
  create(input: CreateDailyNoteInput): CreateDailyNoteResult;
  findById(id: string): DailyNoteRecord | null;
  listRecent(limit: number): DailyNoteRecord[];
  listByDate(dateKey: string): DailyNoteRecord[];
  update(id: string, text: string): CreateDailyNoteResult;
  delete(id: string): boolean;
}

const NOTE_ID_PREFIX = 'N';

export interface NoteRepositoryOptions {
  wikiRoot?: string;
}

function dailyFilePath(wikiRoot: string, dateKey: string): string {
  return notesDailyFilePath(dateKey, wikiRoot);
}

function todayDateKey(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildDailyNoteHeader(dateKey: string): string {
  return `---
date: "${dateKey}"
type: "note-daily"
---

# Notes ${dateKey}

`;
}

function formatTimeHM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function serializeEntry(
  id: string,
  title: string,
  content: string,
  created: Date,
  sessionId: string,
): string {
  const ts = created.toISOString();
  const timeLabel = formatTimeHM(created);
  return `## [${timeLabel}] ${title}
id: ${id}
created: ${ts}
session_id: ${sessionId}

${content}

---

`;
}

function collectNoteIds(wikiRoot: string): string[] {
  const ids: string[] = [];
  for (const fileName of listDailyFiles(wikiRoot)) {
    let text = '';
    try {
      const fullPath = dailyFilePath(wikiRoot, fileName.replace(/\.md$/, ''));
      text = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const match = line.match(/^id:\s*(N\d+)\s*$/i);
      if (match) ids.push(match[1].toUpperCase());
    }
  }
  return ids;
}

function generateNoteId(wikiRoot: string): string {
  const existingIds = collectNoteIds(wikiRoot);
  return allocateSequentialId(NOTE_ID_PREFIX, existingIds);
}

function parseEntriesFromFile(fullPath: string, dateKey: string): DailyNoteRecord[] {
  let text = '';
  try {
    text = fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return [];
  }

  const lines = text.split('\n');
  const entries: DailyNoteRecord[] = [];
  for (let i = 0; i < lines.length; i++) {
    const titleMatch = lines[i].match(/^## \[(\d{2}:\d{2})\]\s+(.+)$/);
    if (!titleMatch) continue;

    const title = (titleMatch[2] || '').trim() || 'Untitled';
    const idLine = lines[i + 1] || '';
    const createdLine = lines[i + 2] || '';
    const sessionLine = lines[i + 3] || '';
    const idMatch = idLine.match(/^id:\s*(.+)$/i);
    const createdMatch = createdLine.match(/^created:\s*(.+)$/i);
    const sessionMatch = sessionLine.match(/^session_id:\s*(.+)$/i);
    const id = (idMatch?.[1] || '').trim();
    if (!id) continue;

    const created = (createdMatch?.[1] || '').trim() || new Date().toISOString();
    const sessionId = (sessionMatch?.[1] || '').trim();
    const bodyLines: string[] = [];
    for (let j = i + 4; j < lines.length; j++) {
      if (lines[j].trim() === '---') break;
      bodyLines.push(lines[j]);
    }
    const body = bodyLines.join('\n').trim();

    entries.push({
      id,
      title,
      created,
      path: fullPath,
      body,
      sessionId: sessionId || undefined,
      dateKey,
    });
  }
  return entries;
}

function listDailyFiles(wikiRoot: string): string[] {
  const dir = wikiNotesDir(wikiRoot);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort((a, b) => b.localeCompare(a));
}

function rewriteDailyFile(
  wikiRoot: string,
  dateKey: string,
  entries: DailyNoteRecord[],
): boolean {
  const dir = wikiNotesDir(wikiRoot);
  const filePath = dailyFilePath(wikiRoot, dateKey);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let body = buildDailyNoteHeader(dateKey);
  const sorted = [...entries].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
  );
  for (const entry of sorted) {
    const created = new Date(entry.created);
    const content = entry.body ?? '';
    body += serializeEntry(
      entry.id,
      entry.title,
      content,
      Number.isNaN(created.getTime()) ? new Date() : created,
      entry.sessionId || process.env.FLOW_SESSION_ID || 'unknown',
    );
  }

  try {
    fs.writeFileSync(filePath, body, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export class FileNoteRepository implements NoteRepository {
  private readonly wikiRoot: string;

  constructor(options: NoteRepositoryOptions = {}) {
    this.wikiRoot = options.wikiRoot ?? resolveWikiRoot();
  }

  create(input: CreateDailyNoteInput): CreateDailyNoteResult {
    const text = input.text.trim();
    if (!text) {
      return { ok: false, reason: 'empty_text' };
    }

    const firstLine = text.split('\n')[0].trim();
    const title = (firstLine || text).slice(0, 80);
    const id = generateNoteId(this.wikiRoot);
    const now = new Date();
    const dateKey = todayDateKey();
    const sessionId = input.sessionId?.trim() || process.env.FLOW_SESSION_ID || 'unknown';
    ensureDir(wikiNotesDir(this.wikiRoot));
    const dir = wikiNotesDir(this.wikiRoot);
    const filePath = dailyFilePath(this.wikiRoot, dateKey);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const entryText = serializeEntry(id, title, text, now, sessionId);
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, buildDailyNoteHeader(dateKey), 'utf-8');
      }
      fs.appendFileSync(filePath, entryText, 'utf-8');
      return { ok: true, id, title, path: filePath };
    } catch {
      return { ok: false, reason: 'io_error' };
    }
  }

  findById(id: string): DailyNoteRecord | null {
    const needle = id.trim();
    if (!needle) return null;

    for (const fileName of listDailyFiles(this.wikiRoot)) {
      const dateKey = fileName.replace(/\.md$/, '');
      const fullPath = path.join(wikiNotesDir(this.wikiRoot), fileName);
      const entries = parseEntriesFromFile(fullPath, dateKey);
      const hit = entries.find((entry) => entry.id === needle);
      if (hit) return hit;
    }
    return null;
  }

  listRecent(limit: number): DailyNoteRecord[] {
    const output: DailyNoteRecord[] = [];
    for (const fileName of listDailyFiles(this.wikiRoot)) {
      if (output.length >= limit) break;
      const dateKey = fileName.replace(/\.md$/, '');
      const fullPath = path.join(wikiNotesDir(this.wikiRoot), fileName);
      const entries = parseEntriesFromFile(fullPath, dateKey);
      entries.reverse();
      for (const entry of entries) {
        output.push(entry);
        if (output.length >= limit) break;
      }
    }
    return output;
  }

  listByDate(dateKey: string): DailyNoteRecord[] {
    const filePath = dailyFilePath(this.wikiRoot, dateKey);
    if (!fs.existsSync(filePath)) return [];
    return parseEntriesFromFile(filePath, dateKey);
  }

  update(id: string, text: string): CreateDailyNoteResult {
    const existing = this.findById(id);
    const trimmed = text.trim();
    if (!existing) {
      return { ok: false, reason: 'not_found' };
    }
    if (!trimmed) {
      return { ok: false, reason: 'empty_text' };
    }

    const dateKey = existing.dateKey || todayDateKey();
    const firstLine = trimmed.split('\n')[0].trim();
    const title = (firstLine || trimmed).slice(0, 80);
    const entries = this.listByDate(dateKey).map((entry) => (
      entry.id === id
        ? { ...entry, title, body: trimmed }
        : entry
    ));

    if (!rewriteDailyFile(this.wikiRoot, dateKey, entries)) {
      return { ok: false, reason: 'io_error' };
    }
    return { ok: true, id, title, path: existing.path };
  }

  delete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing?.dateKey) return false;

    const remaining = this.listByDate(existing.dateKey).filter((entry) => entry.id !== id);
    if (remaining.length === 0) {
      const filePath = dailyFilePath(this.wikiRoot, existing.dateKey);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return true;
      } catch {
        return false;
      }
    }
    return rewriteDailyFile(this.wikiRoot, existing.dateKey, remaining);
  }
}
