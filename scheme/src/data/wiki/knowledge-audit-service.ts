/**
 * File user audit feedback under wiki/knowledge/audit/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ensureKnowledgeMetaLayout,
  knowledgeAuditDir,
} from './wiki-data-layout';
import { resolveWikiRoot } from '../env';

export type AuditSeverity = 'low' | 'medium' | 'high';

export interface KnowledgeAuditInput {
  targetId: string;
  anchor: string;
  severity?: AuditSeverity;
  body?: string;
  sessionId?: string;
  explorationId?: string;
  request?: string;
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function fileKnowledgeAudit(
  input: KnowledgeAuditInput,
  wikiRoot?: string,
): { path: string; id: string } {
  const root = wikiRoot ?? resolveWikiRoot();
  ensureKnowledgeMetaLayout(root);
  const auditDir = knowledgeAuditDir(root);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const id = `${stamp}-${sanitizeFilePart(input.targetId)}`;
  const filePath = path.join(auditDir, `${id}.md`);

  const severity = input.severity ?? 'medium';
  const lines = [
    '---',
    `target_id: "${input.targetId}"`,
    `severity: ${severity}`,
    `filed_at: "${new Date().toISOString()}"`,
    input.sessionId ? `session_id: "${input.sessionId}"` : null,
    input.explorationId ? `exploration_id: "${input.explorationId}"` : null,
    'status: open',
    '---',
    '',
    '## Anchor',
    input.anchor.trim(),
    '',
  ];

  if (input.request?.trim()) {
    lines.push('## Context request', input.request.trim(), '');
  }
  if (input.body?.trim()) {
    lines.push('## Notes', input.body.trim(), '');
  }

  fs.writeFileSync(filePath, lines.filter((l) => l !== null).join('\n'), 'utf-8');
  return { path: filePath, id };
}

export interface OpenKnowledgeAudit {
  fileName: string;
  filePath: string;
  targetId: string;
  severity: AuditSeverity;
  status: string;
  filedAt?: string;
  sessionId?: string;
  explorationId?: string;
  anchorExcerpt?: string;
}

function parseAuditFrontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"\n]*)"?\s*$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

export function listOpenAudits(wikiRoot?: string): OpenKnowledgeAudit[] {
  const root = wikiRoot ?? resolveWikiRoot();
  const auditDir = knowledgeAuditDir(root);
  if (!fs.existsSync(auditDir)) return [];

  const open: OpenKnowledgeAudit[] = [];
  for (const entry of fs.readdirSync(auditDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const filePath = path.join(auditDir, entry.name);
    const content = fs.readFileSync(filePath, 'utf-8');
    const fm = parseAuditFrontmatter(content);
    const status = fm.status || 'open';
    if (status !== 'open') continue;

    const anchorMatch = content.match(/## Anchor\n([\s\S]*?)(?:\n## |\n*$)/);
    open.push({
      fileName: entry.name,
      filePath,
      targetId: fm.target_id || 'unknown',
      severity: (fm.severity as AuditSeverity) || 'medium',
      status,
      filedAt: fm.filed_at,
      sessionId: fm.session_id,
      explorationId: fm.exploration_id,
      anchorExcerpt: anchorMatch?.[1]?.trim().slice(0, 200),
    });
  }

  open.sort((a, b) => {
    const sev = auditSeverityRank(a.severity) - auditSeverityRank(b.severity);
    if (sev !== 0) return sev;
    return (a.filedAt || '').localeCompare(b.filedAt || '');
  });
  return open;
}

function auditSeverityRank(severity: AuditSeverity): number {
  if (severity === 'high') return 0;
  if (severity === 'medium') return 1;
  return 2;
}

export function resolveKnowledgeAudit(
  auditFileName: string,
  wikiRoot?: string,
  resolutionNote?: string,
): { ok: boolean; resolvedPath?: string; reason?: string } {
  const root = wikiRoot ?? resolveWikiRoot();
  const auditDir = knowledgeAuditDir(root);
  const sourcePath = path.join(auditDir, auditFileName);
  if (!fs.existsSync(sourcePath)) {
    return { ok: false, reason: 'audit_not_found' };
  }

  const resolvedDir = path.join(auditDir, 'resolved');
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  let content = fs.readFileSync(sourcePath, 'utf-8');
  if (/^status:\s*open/m.test(content)) {
    content = content.replace(/^status:\s*open/m, 'status: resolved');
  } else {
    content = content.replace(/^---\n/, '---\nstatus: resolved\n');
  }
  const resolvedAt = new Date().toISOString();
  if (!/^resolved_at:/m.test(content)) {
    content = content.replace(/^---\n/, `---\nresolved_at: "${resolvedAt}"\n`);
  }

  if (!/^# Resolution/m.test(content)) {
    const note = resolutionNote?.trim() || 'accepted via wiki-maintain';
    const date = resolvedAt.slice(0, 10);
    content = `${content.trimEnd()}\n\n# Resolution\n\n${date} · ${note}\n`;
  }

  const destPath = path.join(resolvedDir, auditFileName);
  fs.writeFileSync(destPath, content, 'utf-8');
  fs.rmSync(sourcePath, { force: true });
  return { ok: true, resolvedPath: destPath };
}

/** Human-readable open + resolved audit listing for wiki-maintain CLI. */
export function formatAuditListing(wikiRoot?: string): string {
  const root = wikiRoot ?? resolveWikiRoot();
  const auditDir = knowledgeAuditDir(root);
  if (!fs.existsSync(auditDir)) {
    return `No audit directory: ${auditDir}`;
  }

  const lines: string[] = ['Open audit filings:'];
  const open = listOpenAudits(root);
  if (open.length === 0) {
    lines.push('  (none)');
  } else {
    for (const audit of open) {
      lines.push(`  [${audit.severity}] ${audit.targetId} — ${audit.fileName}`);
    }
  }

  lines.push('');
  lines.push('Resolved:');
  const resolvedDir = path.join(auditDir, 'resolved');
  if (!fs.existsSync(resolvedDir)) {
    lines.push('  (none)');
  } else {
    const resolved = fs
      .readdirSync(resolvedDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort();
    if (resolved.length === 0) {
      lines.push('  (none)');
    } else {
      for (const name of resolved) {
        lines.push(`  ${path.join(resolvedDir, name)}`);
      }
    }
  }

  return lines.join('\n');
}
