/**
 * Append maintenance events to wiki/knowledge/log/YYYY-MM-DD.md
 */

import * as fs from 'node:fs';
import {
  ensureDir,
  ensureKnowledgeMetaLayout,
  knowledgeLogPath,
} from './wiki-data-layout';
import { resolveWikiRoot } from '../env';

export type KnowledgeLogOp =
  | 'ingest'
  | 'update'
  | 'skip'
  | 'compile'
  | 'audit'
  | 'lint';

export interface KnowledgeLogEntry {
  op: KnowledgeLogOp;
  id?: string;
  reason?: string;
  at?: Date;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function timeLabel(d: Date): string {
  return d.toISOString().slice(11, 16);
}

function formatLogLine(entry: KnowledgeLogEntry, at: Date): string {
  const parts = [`## [${timeLabel(at)}] ${entry.op}`];
  if (entry.id) parts.push(`target: ${entry.id}`);
  if (entry.reason) parts.push(`reason: ${entry.reason}`);
  return parts.join(' · ');
}

export function appendKnowledgeLog(
  entry: KnowledgeLogEntry,
  wikiRoot?: string,
): string {
  const root = wikiRoot ?? resolveWikiRoot();
  ensureKnowledgeMetaLayout(root);
  const at = entry.at ?? new Date();
  const logPath = knowledgeLogPath(dateKey(at), root);
  ensureDir(logPath.replace(/\/[^/]+$/, ''));

  const line = formatLogLine(entry, at);
  const block = fs.existsSync(logPath)
    ? `\n${line}\n`
    : `# Knowledge log ${dateKey(at)}\n\n${line}\n`;

  fs.appendFileSync(logPath, block, 'utf-8');
  return logPath;
}
