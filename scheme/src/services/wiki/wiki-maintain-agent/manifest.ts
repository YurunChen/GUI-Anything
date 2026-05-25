/**
 * Wiki maintain manifest — JSON at end of agentic /llm-wiki Phase 2 run.
 */

import { extractJsonFromText } from '../../ai/structured-output';

export interface WikiMaintainFileMove {
  from: string;
  to: string;
}

export interface WikiMaintainEntryMerge {
  keep_id: string;
  remove_ids: string[];
}

export interface WikiMaintainManifest {
  action: 'apply' | 'skip';
  reason: string;
  files_written?: string[];
  files_moved?: WikiMaintainFileMove[];
  audits_resolved?: string[];
  entries_merged?: WikiMaintainEntryMerge[];
}

export function parseWikiMaintainManifest(raw: string): WikiMaintainManifest | null {
  const jsonText = extractJsonFromText(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const m = parsed as Record<string, unknown>;
  const action = m.action;
  if (action !== 'apply' && action !== 'skip') return null;

  const reason = typeof m.reason === 'string' && m.reason.trim()
    ? m.reason.trim()
    : action;

  const filesWritten = Array.isArray(m.files_written)
    ? m.files_written.filter((f): f is string => typeof f === 'string').slice(0, 30)
    : undefined;

  const filesMoved = Array.isArray(m.files_moved)
    ? m.files_moved
      .filter((item): item is WikiMaintainFileMove => {
        if (!item || typeof item !== 'object') return false;
        const row = item as Record<string, unknown>;
        return typeof row.from === 'string' && typeof row.to === 'string';
      })
      .slice(0, 20)
    : undefined;

  const auditsResolved = Array.isArray(m.audits_resolved)
    ? m.audits_resolved.filter((f): f is string => typeof f === 'string').slice(0, 30)
    : undefined;

  const entriesMerged = Array.isArray(m.entries_merged)
    ? m.entries_merged
      .filter((item): item is WikiMaintainEntryMerge => {
        if (!item || typeof item !== 'object') return false;
        const row = item as Record<string, unknown>;
        return typeof row.keep_id === 'string'
          && Array.isArray(row.remove_ids)
          && row.remove_ids.every((id) => typeof id === 'string');
      })
      .slice(0, 10)
    : undefined;

  if (action === 'apply') {
    const hasWork = (filesWritten && filesWritten.length > 0)
      || (filesMoved && filesMoved.length > 0)
      || (auditsResolved && auditsResolved.length > 0)
      || (entriesMerged && entriesMerged.length > 0);
    if (!hasWork) return null;
  }

  return {
    action,
    reason,
    files_written: filesWritten,
    files_moved: filesMoved,
    audits_resolved: auditsResolved,
    entries_merged: entriesMerged,
  };
}

export const WIKI_MAINTAIN_MANIFEST_SCHEMA = `{
  "action": "apply" | "skip",
  "reason": "简短说明",
  "files_written": ["knowledge/contexts/implement/C001-slug.md"],
  "files_moved": [{ "from": "knowledge/contexts/C002-old.md", "to": "knowledge/contexts/refactor/C002-old.md" }],
  "audits_resolved": ["2026-05-25T12-00-00-C001.md"],
  "entries_merged": [{ "keep_id": "C001", "remove_ids": ["C003"] }]
}

apply: 至少一项 files_written / files_moved / audits_resolved；禁止 delete。
skip: 勿填 files_* / audits_resolved。`;
