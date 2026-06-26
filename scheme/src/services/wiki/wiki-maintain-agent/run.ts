/**
 * Wiki Maintain Agent — agentic /llm-wiki Phase 2 (manual CLI).
 */

import { resolveWikiRoot } from '../../../data/env';
import { runClaudeAgentPrompt, runClaudePrintPrompt } from '../../ai/flow-summaries';
import type { WikiMaintenanceReport } from '../wiki-maintenance-report';
import { buildWikiMaintainSkillPrompt } from './prompt';
import {
  parseWikiMaintainManifest,
  type WikiMaintainManifest,
} from './manifest';
import { resolveWikiModel, shouldUseClaudeWikiAgent } from '../wiki-agent/run';
import {
  resolveWikiAgentAddDirs,
  resolveWikiClaudeCwd,
} from '../wiki-claude-context';

export function shouldRunWikiMaintainAgent(): boolean {
  const disabled = (process.env.FLOW_WIKI_MAINTAIN || '').trim().toLowerCase();
  if (disabled === '0' || disabled === 'false' || disabled === 'no') return false;
  return shouldUseClaudeWikiAgent();
}

export function shouldRunWikiMaintainAfterIngest(): boolean {
  const disabled = (process.env.FLOW_WIKI_MAINTAIN_AFTER_INGEST || '1').trim().toLowerCase();
  if (disabled === '0' || disabled === 'false' || disabled === 'no') return false;
  return shouldRunWikiMaintainAgent();
}

export function shouldUseAgenticMaintainSkill(): boolean {
  const printOnly = (process.env.FLOW_WIKI_MAINTAIN_PRINT_ONLY || '').trim().toLowerCase();
  if (printOnly === '1' || printOnly === 'true') return false;
  return shouldRunWikiMaintainAgent();
}

export async function runWikiMaintainSkill(
  report: WikiMaintenanceReport,
): Promise<{
  manifest: WikiMaintainManifest | null;
  source: 'skill' | 'disabled' | 'failed';
  reason?: string;
}> {
  if (!shouldRunWikiMaintainAgent()) {
    return { manifest: null, source: 'disabled', reason: 'maintain_disabled' };
  }

  const wikiRoot = resolveWikiRoot();
  const promptText = buildWikiMaintainSkillPrompt(report);
  const claudeCwd = resolveWikiClaudeCwd();

  if (!shouldUseAgenticMaintainSkill()) {
    const printResult = await runClaudePrintPrompt(promptText, {
      model: resolveWikiModel(),
      timeoutMs: 120_000,
      cwd: claudeCwd,
    });
    if (!printResult.ok) {
      return { manifest: null, source: 'failed', reason: printResult.reason ?? 'print_failed' };
    }
    const manifest = parseWikiMaintainManifest(printResult.output);
    if (!manifest) {
      return { manifest: null, source: 'failed', reason: 'manifest_parse_failed' };
    }
    return { manifest, source: 'skill' };
  }

  const result = await runClaudeAgentPrompt(promptText, {
    model: resolveWikiModel(),
    timeoutMs: 180_000,
    permissionMode: 'acceptEdits',
    allowedTools: ['Read', 'Edit', 'Write'],
    addDir: resolveWikiAgentAddDirs(wikiRoot),
    cwd: claudeCwd,
  });

  if (!result.ok) {
    return { manifest: null, source: 'failed', reason: result.reason ?? 'skill_failed' };
  }

  const manifest = parseWikiMaintainManifest(result.output);
  if (!manifest) {
    return { manifest: null, source: 'failed', reason: 'manifest_parse_failed' };
  }

  return { manifest, source: 'skill' };
}
