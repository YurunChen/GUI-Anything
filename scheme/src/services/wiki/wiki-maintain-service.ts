/**
 * Post-process wiki maintain manifest: resolve audits, apply moves, rebuild index.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveKnowledgeAudit } from '../../data/wiki/knowledge-audit-service';
import { KnowledgeRepository } from '../../data/wiki/knowledge-repository';
import { rebuildKnowledgeIndex } from '../../data/wiki/knowledge-index-service';
import { appendKnowledgeLog } from '../../data/wiki/knowledge-log-service';
import { regenerateProgressPage } from './progress-html-service';
import { sanitizeKnowledgeRelativePath } from './wiki-agent/validate-agent-write';
import type { WikiMaintainManifest } from './wiki-maintain-agent/manifest';
import {
  runWikiMaintainSkill,
  shouldRunWikiMaintainAfterIngest,
} from './wiki-maintain-agent/run';
import {
  validateAuditFileNames,
  validateMaintainManifestFiles,
} from './wiki-maintain-agent/validate-maintain-write';
import {
  buildWikiMaintenanceReport,
  maintenanceReportHasWork,
  type WikiMaintenanceReport,
} from './wiki-maintenance-report';

export interface WikiMaintainApplyResult {
  ok: boolean;
  reason?: string;
  auditsResolved: string[];
  filesMoved: number;
  entriesMerged: number;
}

function stampMergedNotice(content: string, keepId: string): string {
  const banner = `> **merged_into:** ${keepId}\n> **status:** merged\n\n`;
  if (content.includes('merged_into')) return content;
  const fmEnd = content.match(/^---\n[\s\S]*?\n---\n/);
  if (fmEnd) {
    const idx = fmEnd[0].length;
    return content.slice(0, idx) + banner + content.slice(idx);
  }
  return banner + content;
}

function patchIntentKeyFrontmatter(content: string, intentKey: string): string {
  if (/^intent_key:/m.test(content)) {
    return content.replace(/^intent_key:.*$/m, `intent_key: "${intentKey}"`);
  }
  return content.replace(/^---\n/, `---\nintent_key: "${intentKey}"\n`);
}

function inferIntentKeyFromPath(relPath: string): string | undefined {
  const parts = relPath.split('/');
  const contextsIdx = parts.indexOf('contexts');
  if (contextsIdx >= 0 && parts[contextsIdx + 1] && !parts[contextsIdx + 1].match(/^C\d{3}/i)) {
    return parts[contextsIdx + 1];
  }
  return undefined;
}

export async function applyWikiMaintainManifest(
  manifest: WikiMaintainManifest,
  knowledgeRepo = new KnowledgeRepository(),
): Promise<WikiMaintainApplyResult> {
  if (manifest.action === 'skip') {
    appendKnowledgeLog({ op: 'skip', reason: manifest.reason || 'maintain_skip' });
    return { ok: true, reason: 'skip', auditsResolved: [], filesMoved: 0, entriesMerged: 0 };
  }

  const wikiRoot = knowledgeRepo.getRoot();
  const fileProof = validateMaintainManifestFiles(manifest, wikiRoot);
  if (!fileProof.ok) {
    return {
      ok: false,
      reason: fileProof.reason ?? 'files_invalid',
      auditsResolved: [],
      filesMoved: 0,
      entriesMerged: 0,
    };
  }

  const auditNames = manifest.audits_resolved ?? [];
  if (auditNames.length > 0) {
    const auditCheck = validateAuditFileNames(auditNames, wikiRoot);
    if (!auditCheck.ok) {
      return {
        ok: false,
        reason: auditCheck.reason,
        auditsResolved: [],
        filesMoved: 0,
        entriesMerged: 0,
      };
    }
  }

  let filesMoved = 0;
  for (const move of manifest.files_moved ?? []) {
    const toRel = sanitizeKnowledgeRelativePath(move.to, wikiRoot);
    if (!toRel) continue;
    const toAbs = path.join(wikiRoot, toRel);
    if (!fs.existsSync(toAbs)) continue;

    const fromRel = sanitizeKnowledgeRelativePath(move.from, wikiRoot);
    if (fromRel) {
      const fromAbs = path.join(wikiRoot, fromRel);
      if (fs.existsSync(fromAbs)) {
        fs.mkdirSync(path.dirname(toAbs), { recursive: true });
        let content = fs.readFileSync(fromAbs, 'utf-8');
        const intentKey = inferIntentKeyFromPath(toRel);
        if (intentKey) content = patchIntentKeyFrontmatter(content, intentKey);
        fs.writeFileSync(toAbs, content, 'utf-8');
        fs.rmSync(fromAbs, { force: true });
      }
    }
    filesMoved += 1;
  }

  let entriesMerged = 0;
  for (const merge of manifest.entries_merged ?? []) {
    for (const removeId of merge.remove_ids) {
      const entry = await knowledgeRepo.findById(removeId);
      if (!entry) continue;
      const updated = stampMergedNotice(entry.content, merge.keep_id);
      if (updated !== entry.content) {
        await knowledgeRepo.save({ ...entry, content: updated }, { overwrite: true });
        entriesMerged += 1;
      }
    }
  }

  const auditsResolved: string[] = [];
  for (const name of auditNames) {
    const result = resolveKnowledgeAudit(name, wikiRoot, manifest.reason);
    if (result.ok) auditsResolved.push(name);
  }

  await rebuildKnowledgeIndex(knowledgeRepo);
  await regenerateProgressPage(knowledgeRepo);

  appendKnowledgeLog({
    op: 'update',
    reason: manifest.reason || 'maintain_apply',
  });

  return {
    ok: true,
    auditsResolved,
    filesMoved,
    entriesMerged,
  };
}

export async function runWikiMaintainPipeline(
  report: WikiMaintenanceReport,
): Promise<WikiMaintainApplyResult & { manifest: WikiMaintainManifest | null; agentReason?: string }> {
  const agent = await runWikiMaintainSkill(report);
  if (!agent.manifest) {
    return {
      ok: false,
      reason: agent.reason ?? 'agent_failed',
      manifest: null,
      agentReason: agent.reason,
      auditsResolved: [],
      filesMoved: 0,
      entriesMerged: 0,
    };
  }

  const applied = await applyWikiMaintainManifest(agent.manifest);
  return { ...applied, manifest: agent.manifest, agentReason: agent.reason };
}

/**
 * After Phase 1 ingest, run Phase 2 when the maintenance report has work.
 * Same /llm-wiki skill; gated by FLOW_WIKI_MAINTAIN_AFTER_INGEST (default on).
 */
export async function maybeRunWikiMaintainAfterIngest(
  wikiRoot?: string,
): Promise<{ ran: boolean; ok?: boolean; reason?: string }> {
  if (!shouldRunWikiMaintainAfterIngest()) {
    return { ran: false, reason: 'after_ingest_disabled' };
  }

  const report = buildWikiMaintenanceReport({ wikiRoot });
  if (!maintenanceReportHasWork(report)) {
    return { ran: false, reason: 'nothing_to_maintain' };
  }

  const result = await runWikiMaintainPipeline(report);
  if (!result.ok) {
    appendKnowledgeLog({
      op: 'skip',
      reason: `maintain_after_ingest:${result.reason ?? 'failed'}`,
    });
  }
  return { ran: true, ok: result.ok, reason: result.reason };
}
