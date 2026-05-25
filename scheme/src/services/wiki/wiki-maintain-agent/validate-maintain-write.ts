/**
 * Validate maintain manifest paths and disk proof.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  knowledgeAuditDir,
  wikiKnowledgeDir,
} from '../../../data/wiki/wiki-data-layout';
import { sanitizeKnowledgeRelativePath } from '../wiki-agent/validate-agent-write';
import type { WikiMaintainManifest } from './manifest';

export interface MaintainWriteProof {
  ok: boolean;
  paths: string[];
  reason?: string;
}

export function sanitizeAuditResolvedRelativePath(
  rel: string,
  wikiRoot: string,
): string | null {
  let trimmed = rel.trim().replace(/\\/g, '/');
  if (!trimmed || trimmed.includes('..')) return null;
  if (trimmed.startsWith('wiki/')) trimmed = trimmed.slice('wiki/'.length);
  if (!trimmed.startsWith('knowledge/audit/resolved/')) return null;
  if (!trimmed.endsWith('.md')) return null;

  const auditRoot = path.resolve(knowledgeAuditDir(wikiRoot));
  const abs = path.resolve(wikiRoot, trimmed);
  if (!abs.startsWith(path.join(auditRoot, 'resolved') + path.sep)) return null;
  return trimmed;
}

export function validateMaintainManifestFiles(
  manifest: WikiMaintainManifest,
  wikiRoot: string,
): MaintainWriteProof {
  if (manifest.action === 'skip') {
    return { ok: true, paths: [] };
  }

  const paths: string[] = [];
  const hasAuditsOnly = (manifest.audits_resolved?.length ?? 0) > 0
    && !(manifest.files_written?.length)
    && !(manifest.files_moved?.length);

  if (hasAuditsOnly) {
    return { ok: true, paths: [] };
  }

  for (const raw of manifest.files_written ?? []) {
    const rel = sanitizeKnowledgeRelativePath(raw, wikiRoot);
    if (!rel) return { ok: false, paths: [], reason: `invalid_path:${raw}` };
    const abs = path.join(wikiRoot, rel);
    if (!fs.existsSync(abs)) {
      return { ok: false, paths: [], reason: `missing_file:${rel}` };
    }
    paths.push(rel);
  }

  for (const move of manifest.files_moved ?? []) {
    const toRel = sanitizeKnowledgeRelativePath(move.to, wikiRoot);
    if (!toRel) return { ok: false, paths: [], reason: `invalid_move_to:${move.to}` };
    const toAbs = path.join(wikiRoot, toRel);
    if (!fs.existsSync(toAbs)) {
      return { ok: false, paths: [], reason: `missing_move_dest:${toRel}` };
    }
    paths.push(toRel);
  }

  return { ok: true, paths };
}

export function validateAuditFileNames(
  fileNames: string[],
  wikiRoot: string,
): { ok: boolean; reason?: string } {
  const auditDir = knowledgeAuditDir(wikiRoot);
  for (const name of fileNames) {
    if (name.includes('/') || name.includes('..')) {
      return { ok: false, reason: `invalid_audit_name:${name}` };
    }
    const openPath = path.join(auditDir, name);
    if (!fs.existsSync(openPath)) {
      return { ok: false, reason: `audit_not_open:${name}` };
    }
  }
  return { ok: true };
}

export function assertKnowledgeWriteBoundary(rel: string, wikiRoot: string): boolean {
  const knowledgeRoot = path.resolve(wikiKnowledgeDir(wikiRoot));
  const abs = path.resolve(wikiRoot, rel.startsWith('knowledge/') ? rel : `knowledge/${rel}`);
  return abs.startsWith(knowledgeRoot + path.sep) || abs === knowledgeRoot;
}
