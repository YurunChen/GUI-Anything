/**
 * Verify agentic /llm-wiki disk writes before post-process (index/log/progress).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WikiMatch } from '../../../data/protocol/wiki-types';
import {
  KNOWLEDGE_AGENT_ONLY_DIRS,
  KNOWLEDGE_ENTRY_DIRS,
  wikiKnowledgeDir,
} from '../../../data/wiki/wiki-data-layout';

const ALLOWED_KNOWLEDGE_DIRS = [
  ...KNOWLEDGE_ENTRY_DIRS,
  ...KNOWLEDGE_AGENT_ONLY_DIRS,
] as const;
import type { KnowledgeRepository } from '../../../data/wiki/knowledge-repository';
import type { WikiAgentManifest } from './manifest';

export interface AgentWriteProof {
  ok: boolean;
  targetId?: string;
  paths?: string[];
  reason?: string;
}

/** Normalize and validate a path relative to wiki root (main entry dirs only). */
export function sanitizeKnowledgeRelativePath(
  rel: string,
  wikiRoot: string,
): string | null {
  let trimmed = rel.trim().replace(/\\/g, '/');
  if (!trimmed || trimmed.startsWith('/') || /^[a-zA-Z]:/.test(trimmed)) {
    return null;
  }
  if (trimmed.includes('..')) return null;

  if (trimmed.startsWith('wiki/')) {
    trimmed = trimmed.slice('wiki/'.length);
  }
  if (!trimmed.startsWith('knowledge/')) {
    trimmed = `knowledge/${trimmed}`;
  }

  const subPath = trimmed.slice('knowledge/'.length);
  const firstSeg = subPath.split('/')[0];
  if (!(ALLOWED_KNOWLEDGE_DIRS as readonly string[]).includes(firstSeg)) {
    return null;
  }

  const knowledgeRoot = path.resolve(wikiKnowledgeDir(wikiRoot));
  const abs = path.resolve(wikiRoot, trimmed);
  if (!abs.startsWith(knowledgeRoot + path.sep) && abs !== knowledgeRoot) {
    return null;
  }
  if (!abs.endsWith('.md')) return null;

  return trimmed;
}

export function validateManifestFilesWritten(
  manifest: WikiAgentManifest,
  wikiRoot: string,
): { ok: boolean; paths: string[]; reason?: string } {
  const files = manifest.files_written;
  if (!files?.length) {
    return { ok: false, paths: [], reason: 'no_files_written' };
  }

  const resolved: string[] = [];
  for (const raw of files) {
    const rel = sanitizeKnowledgeRelativePath(raw, wikiRoot);
    if (!rel) {
      return { ok: false, paths: [], reason: `invalid_path:${raw}` };
    }
    const abs = path.join(wikiRoot, rel);
    if (!fs.existsSync(abs)) {
      return { ok: false, paths: [], reason: `missing_file:${rel}` };
    }
    resolved.push(rel);
  }

  return { ok: true, paths: resolved };
}

function inferIdFromPaths(paths: string[]): string | undefined {
  for (const rel of paths) {
    const base = rel.split('/').pop() ?? rel;
    const m = base.match(/^([A-Z]\d+)-/);
    if (m) return m[1];
  }
  return undefined;
}

export async function resolveAgentWriteProof(
  manifest: WikiAgentManifest,
  wikiRoot: string,
  repo: KnowledgeRepository,
  sessionId: string,
  explorationId: string,
  priorHit: WikiMatch | null,
): Promise<AgentWriteProof> {
  if (manifest.action === 'skip') {
    return { ok: false, reason: 'skip' };
  }

  const fileCheck = validateManifestFilesWritten(manifest, wikiRoot);
  let paths = fileCheck.paths;
  let hasFiles = fileCheck.ok;

  if (!hasFiles && manifest.files_written?.length) {
    return { ok: false, reason: fileCheck.reason ?? 'files_invalid' };
  }

  const targetIdFromManifest = manifest.target_id?.trim()
    ?? priorHit?.entry.id
    ?? inferIdFromPaths(paths);

  if (manifest.action === 'update') {
    const targetId = targetIdFromManifest;
    if (!targetId) {
      return { ok: false, reason: 'update_missing_target_id' };
    }
    const entry = await repo.findById(targetId);
    if (!entry) {
      return { ok: false, reason: `target_not_found:${targetId}` };
    }
    if (hasFiles) {
      return { ok: true, targetId, paths };
    }
    const bySource = await repo.findBySource(sessionId, explorationId);
    if (bySource?.id === targetId) {
      return { ok: true, targetId, paths: [], reason: 'verified_by_source' };
    }
    return { ok: false, reason: 'update_no_files_on_disk' };
  }

  if (manifest.action === 'create') {
    if (hasFiles) {
      const id = targetIdFromManifest ?? inferIdFromPaths(paths);
      return { ok: true, targetId: id, paths };
    }
    const bySource = await repo.findBySource(sessionId, explorationId);
    if (bySource) {
      return { ok: true, targetId: bySource.id, paths: [], reason: 'verified_by_source' };
    }
    return { ok: false, reason: 'create_no_files_on_disk' };
  }

  return { ok: false, reason: 'unknown_action' };
}
