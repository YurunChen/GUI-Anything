/**
 * Programmatic knowledge lint — shared by CLI and maintenance report.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { wikiKnowledgeDir } from './wiki-data-layout';

export type LintLevel = 'error' | 'warn';

export interface LintIssue {
  level: LintLevel;
  message: string;
}

export interface KnowledgeLintResult {
  issues: LintIssue[];
  matchPoolCount: number;
  indexedCount: number;
  errorCount: number;
  warnCount: number;
}

const ENTRY_DIRS = ['contexts', 'entities'] as const;
const INDEX_DIRS = [...ENTRY_DIRS, 'summaries'] as const;
const LEGACY_DIRS = ['errors', 'snippets', 'decisions'] as const;

const CONTEXT_ENTRY_RE = /^C\d{3}-.+\.md$/i;

function walkMarkdown(dir: string, files: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'index.md') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(full, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
}

function listEntryFiles(knowledgeDir: string, subdirs: readonly string[]): string[] {
  const files: string[] = [];
  for (const sub of subdirs) {
    walkMarkdown(path.join(knowledgeDir, sub), files);
  }
  return files;
}

function parseId(content: string, file: string, issues: LintIssue[]): string | null {
  const m = content.match(/^id:\s*"?([^"\n]+)"?/m);
  if (!m) {
    issues.push({ level: 'error', message: `missing id: ${file}` });
    return null;
  }
  return m[1].trim();
}

export function collectLintIssues(wikiRoot: string): KnowledgeLintResult {
  const knowledgeDir = path.join(wikiKnowledgeDir(wikiRoot));
  const issues: LintIssue[] = [];

  for (const legacy of LEGACY_DIRS) {
    const legacyPath = path.join(knowledgeDir, legacy);
    if (fs.existsSync(legacyPath)) {
      const hasMd = fs.readdirSync(legacyPath).some((n) => n.endsWith('.md'));
      if (hasMd) {
        issues.push({
          level: 'error',
          message: `legacy directory ${legacy}/ still has entries — run scripts/wiki/purge-legacy-knowledge.sh or start flow (auto-purge)`,
        });
      }
    }
  }

  const matchPoolFiles = listEntryFiles(knowledgeDir, ENTRY_DIRS);
  const allIndexedFiles = listEntryFiles(knowledgeDir, INDEX_DIRS);
  const ids = new Map<string, string>();
  const requests = new Map<string, string>();

  for (const file of allIndexedFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const id = parseId(content, file, issues);
    if (!id) continue;
    if (ids.has(id)) {
      issues.push({ level: 'error', message: `duplicate id ${id}: ${file} and ${ids.get(id)}` });
    } else {
      ids.set(id, file);
    }
    const req = content.match(/^request:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
    if (req) {
      const key = req.toLowerCase();
      if (requests.has(key)) {
        issues.push({ level: 'warn', message: `duplicate request "${req}": ${file} and ${requests.get(key)}` });
      } else {
        requests.set(key, file);
      }
    }
    if (/^status:\s*"draft"/m.test(content)) {
      const updated = content.match(/^updated:\s*"?([^"\n]+)"?/m)?.[1];
      if (updated) {
        const ageDays = (Date.now() - new Date(updated).getTime()) / 86400000;
        if (ageDays > 30) {
          issues.push({ level: 'warn', message: `draft >30d: ${id} (${file})` });
        }
      }
    }
  }

  const indexPath = path.join(knowledgeDir, 'index.md');
  if (fs.existsSync(indexPath)) {
    const index = fs.readFileSync(indexPath, 'utf-8');
    for (const id of ids.keys()) {
      if (!index.includes(id)) {
        issues.push({ level: 'error', message: `index missing entry: ${id}` });
      }
    }
  } else {
    issues.push({ level: 'warn', message: 'index.md missing — run rebuild or scaffold' });
  }

  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');

  return {
    issues,
    matchPoolCount: matchPoolFiles.length,
    indexedCount: allIndexedFiles.length,
    errorCount: errors.length,
    warnCount: warns.length,
  };
}

export function listFlatContextFiles(wikiRoot: string): string[] {
  const contextsDir = path.join(wikiKnowledgeDir(wikiRoot), 'contexts');
  if (!fs.existsSync(contextsDir)) return [];
  const flat: string[] = [];
  for (const entry of fs.readdirSync(contextsDir, { withFileTypes: true })) {
    if (entry.isFile() && CONTEXT_ENTRY_RE.test(entry.name)) {
      flat.push(path.join(contextsDir, entry.name));
    }
  }
  return flat;
}
