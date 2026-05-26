/**
 * Unified wiki/ layout — three top-level folders only:
 *
 *   wiki/knowledge/   — long-lived knowledge entries (markdown)
 *   wiki/sessions/    — per-session derived + evidence (json)
 *   wiki/notes/       — user daily notes (markdown)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizeSessionIntentKey, SESSION_INTENT_KEYS } from '../../constants/session-intent-keys';
import { resolveWikiRoot } from '../env';
import { RESEARCH_SCHEMA_TEMPLATE } from './knowledge-normalize';

export const WIKI_DIR_KNOWLEDGE = 'knowledge';
export const WIKI_DIR_SESSIONS = 'sessions';
export const WIKI_DIR_NOTES = 'notes';

export function wikiKnowledgeDir(wikiRoot?: string): string {
  return path.join(wikiRoot ?? resolveWikiRoot(), WIKI_DIR_KNOWLEDGE);
}

export function wikiSessionsDir(wikiRoot?: string): string {
  return path.join(wikiRoot ?? resolveWikiRoot(), WIKI_DIR_SESSIONS);
}

export function wikiNotesDir(wikiRoot?: string): string {
  return path.join(wikiRoot ?? resolveWikiRoot(), WIKI_DIR_NOTES);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** wiki/sessions/_index.json — workspace registry + continue pointer */
export function sessionIndexPath(wikiRoot?: string): string {
  return path.join(wikiSessionsDir(wikiRoot), '_index.json');
}

/** wiki/sessions/{sessionId}/ */
export function sessionDir(sessionId: string, wikiRoot?: string): string {
  return path.join(wikiSessionsDir(wikiRoot), sessionId);
}

/** wiki/sessions/{sessionId}/bundle.json */
export function sessionBundlePath(sessionId: string, wikiRoot?: string): string {
  return path.join(sessionDir(sessionId, wikiRoot), 'bundle.json');
}

/** List session ids that have a bundle.json on disk. */
export function listSessionBundleIds(wikiRoot?: string): string[] {
  const root = wikiSessionsDir(wikiRoot);
  if (!fs.existsSync(root)) return [];
  const ids: string[] = [];
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
    const bundle = path.join(root, ent.name, 'bundle.json');
    if (fs.existsSync(bundle)) ids.push(ent.name);
  }
  return ids;
}

export function knowledgeTypeDir(
  typeSubdir: string,
  wikiRoot?: string,
): string {
  return path.join(wikiKnowledgeDir(wikiRoot), typeSubdir);
}

/** Normalized session intent_key used as contexts/ subdir name. */
export function normalizeContextIntentBucket(intentKey: string): string {
  return normalizeSessionIntentKey(intentKey);
}

/** knowledge/contexts/{intent_key}/ — aligns with session intent buckets + Wiki Curator. */
export function contextIntentBucketDir(intentKey: string, wikiRoot?: string): string {
  const bucket = normalizeContextIntentBucket(intentKey);
  return path.join(knowledgeTypeDir('contexts', wikiRoot), bucket);
}

export function notesDailyFilePath(dateKey: string, wikiRoot?: string): string {
  return path.join(wikiNotesDir(wikiRoot), `${dateKey}.md`);
}

/** llm-wiki-style knowledge meta (under wiki/knowledge/ only). */
export const KNOWLEDGE_SCHEMA_FILE = 'SCHEMA.md';
export const KNOWLEDGE_INDEX_FILE = 'index.md';
export const KNOWLEDGE_LOG_DIR = 'log';
export const KNOWLEDGE_AUDIT_DIR = 'audit';
export const KNOWLEDGE_AUDIT_RESOLVED_DIR = 'resolved';

/** UI match pool + agent main entries (recursive under contexts/). */
export const KNOWLEDGE_ENTRY_DIRS = ['contexts', 'entities'] as const;

/** Removed on layout ensure — not read at runtime */
export const LEGACY_KNOWLEDGE_DIRS = ['errors', 'snippets', 'decisions'] as const;

const LEGACY_ENTRY_BASENAME = /^[ESD]\d{3}-.+\.md$/i;

function purgeLegacyIdFiles(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      purgeLegacyIdFiles(full);
    } else if (LEGACY_ENTRY_BASENAME.test(ent.name)) {
      fs.rmSync(full, { force: true });
    }
  }
}

/** Delete legacy top-level dirs and E/S/D-prefixed entry files (no migration). */
export function purgeLegacyKnowledgeLayout(wikiRoot?: string): void {
  const root = wikiKnowledgeDir(wikiRoot);
  for (const legacy of LEGACY_KNOWLEDGE_DIRS) {
    const dir = path.join(root, legacy);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  for (const sub of [...KNOWLEDGE_ENTRY_DIRS, ...KNOWLEDGE_AGENT_ONLY_DIRS]) {
    purgeLegacyIdFiles(path.join(root, sub));
  }
}

/** Agent-only / non-match dirs (summaries excluded from UI KNOWLEDGE card). */
export const KNOWLEDGE_AGENT_ONLY_DIRS = ['summaries'] as const;

export const KNOWLEDGE_OUTPUTS_DIR = 'outputs';
export const KNOWLEDGE_PROGRESS_DIR = 'outputs/progress';
export const KNOWLEDGE_QUERIES_DIR = 'outputs/queries';

export type KnowledgeEntryDir = (typeof KNOWLEDGE_ENTRY_DIRS)[number];

export function knowledgeSchemaPath(wikiRoot?: string): string {
  return path.join(wikiKnowledgeDir(wikiRoot), KNOWLEDGE_SCHEMA_FILE);
}

export function knowledgeIndexPath(wikiRoot?: string): string {
  return path.join(wikiKnowledgeDir(wikiRoot), KNOWLEDGE_INDEX_FILE);
}

export function knowledgeLogDir(wikiRoot?: string): string {
  return path.join(wikiKnowledgeDir(wikiRoot), KNOWLEDGE_LOG_DIR);
}

export function knowledgeLogPath(dateKey: string, wikiRoot?: string): string {
  return path.join(knowledgeLogDir(wikiRoot), `${dateKey}.md`);
}

export function knowledgeAuditDir(wikiRoot?: string): string {
  return path.join(wikiKnowledgeDir(wikiRoot), KNOWLEDGE_AUDIT_DIR);
}

export function knowledgeAuditResolvedDir(wikiRoot?: string): string {
  return path.join(knowledgeAuditDir(wikiRoot), KNOWLEDGE_AUDIT_RESOLVED_DIR);
}

export function knowledgeProgressDir(wikiRoot?: string): string {
  return path.join(wikiKnowledgeDir(wikiRoot), KNOWLEDGE_PROGRESS_DIR);
}

export function knowledgeProgressIndexPath(wikiRoot?: string): string {
  return path.join(knowledgeProgressDir(wikiRoot), 'index.html');
}

export function knowledgeQueriesDir(wikiRoot?: string): string {
  return path.join(wikiKnowledgeDir(wikiRoot), KNOWLEDGE_QUERIES_DIR);
}

/** Ensure knowledge meta dirs exist (SCHEMA/index/log/audit + research three-class tree). */
export function ensureKnowledgeMetaLayout(wikiRoot?: string): void {
  purgeLegacyKnowledgeLayout(wikiRoot);
  const root = wikiKnowledgeDir(wikiRoot);
  ensureDir(root);
  ensureDir(knowledgeLogDir(wikiRoot));
  ensureDir(knowledgeAuditDir(wikiRoot));
  ensureDir(knowledgeAuditResolvedDir(wikiRoot));
  ensureDir(knowledgeProgressDir(wikiRoot));
  ensureDir(knowledgeQueriesDir(wikiRoot));
  for (const sub of KNOWLEDGE_ENTRY_DIRS) {
    ensureDir(path.join(root, sub));
  }
  for (const def of SESSION_INTENT_KEYS) {
    ensureDir(contextIntentBucketDir(def.key, wikiRoot));
  }
  ensureDir(contextIntentBucketDir('greeting', wikiRoot));
  ensureDir(path.join(root, 'summaries'));

  const schemaPath = knowledgeSchemaPath(wikiRoot);
  if (!fs.existsSync(schemaPath)) {
    fs.writeFileSync(schemaPath, RESEARCH_SCHEMA_TEMPLATE, 'utf-8');
  }
  const indexPath = knowledgeIndexPath(wikiRoot);
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(
      indexPath,
      '# Knowledge index\n\n(empty — run flow observer to populate)\n',
      'utf-8',
    );
  }
}
