/**
 * Wiki Agent manifest — JSON block at end of agentic /llm-wiki run.
 */

import { extractJsonFromText } from '../../ai/structured-output';

export interface WikiAgentManifest {
  action: 'create' | 'update' | 'skip';
  target_id?: string;
  files_written?: string[];
  reason: string;
}

export function parseWikiAgentManifest(raw: string): WikiAgentManifest | null {
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
  if (action !== 'create' && action !== 'update' && action !== 'skip') return null;

  const reason = typeof m.reason === 'string' && m.reason.trim()
    ? m.reason.trim()
    : action;

  const targetId = typeof m.target_id === 'string' ? m.target_id.trim() : undefined;
  const filesWritten = Array.isArray(m.files_written)
    ? m.files_written.filter((f): f is string => typeof f === 'string').slice(0, 20)
    : undefined;

  if (action === 'update' && !targetId && (!filesWritten || filesWritten.length === 0)) {
    return null;
  }

  if ((action === 'create' || action === 'update') && (!filesWritten || filesWritten.length === 0)) {
    return null;
  }

  return {
    action,
    target_id: targetId || undefined,
    files_written: filesWritten,
    reason,
  };
}

export const WIKI_AGENT_MANIFEST_SCHEMA = `{
  "action": "create" | "update" | "skip",
  "target_id": "update 必填；create 建议与文件名一致，如 C001",
  "files_written": ["knowledge/contexts/implement/C001-slug.md"],
  "reason": "简短说明（同用户语言）"
}

create/update: files_written 必填（≥1），路径相对 wiki 根，且文件已写入磁盘。
skip: 勿填 files_written；reason 填 skip。`;
