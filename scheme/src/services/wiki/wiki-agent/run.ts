/**
 * Wiki Agent — Claude subagent (llm-wiki ingest/update) + rule fallback + markdown render.
 */

import type { ExplorationSummary } from '../../../data/protocol/wiki-types';
import type { KnowledgeEntry } from '../../../data/wiki/knowledge-repository';
import type { WikiMatch } from '../../../data/protocol/wiki-types';
import { resolveProjectTag, resolveWikiRoot } from '../../../data/env';
import { KnowledgeRepository } from '../../../data/wiki/knowledge-repository';
import { runClaudeAgentPrompt, runClaudePrintPrompt } from '../../ai/flow-summaries';
import type { IntentDigest } from '../intent-digest-service';
import {
  extractWikiEntry,
  type WikiExtractionResult,
} from '../auto-extractor';
import type { WikiAgentDecision, WikiAgentEntryType } from './schema';
import { buildWikiAgentPrompt, buildWikiAgentSkillContext } from './prompt';
import { validateWikiAgentDecision } from './validate';
import {
  parseWikiAgentManifest,
  WIKI_AGENT_MANIFEST_SCHEMA,
  type WikiAgentManifest,
} from './manifest';
import { resolveAgentWriteProof } from './validate-agent-write';
import { applyKnowledgeDatesToYaml, formatKnowledgeDates } from '../../../utils/knowledge-dates';
import {
  resolveWikiAgentAddDirs,
  resolveWikiClaudeCwd,
} from '../wiki-claude-context';

function toAgentEntryType(type: KnowledgeEntry['type']): WikiAgentEntryType {
  return type === 'entity' ? 'entity' : 'context';
}

export interface WikiAgentRunInput {
  summary: ExplorationSummary;
  digest?: IntentDigest;
  priorHit: WikiMatch | null;
  candidates: KnowledgeEntry[];
  targetExcerpt?: string;
  model?: string;
}

/** Default: Claude subagent (like Summary Agent). Set FLOW_WIKI_RULES_ONLY=1 to disable. */
export function shouldUseClaudeWikiAgent(): boolean {
  const rulesOnly = (process.env.FLOW_WIKI_RULES_ONLY || '').trim().toLowerCase();
  if (rulesOnly === '1' || rulesOnly === 'true' || rulesOnly === 'yes') return false;
  const disabled = (process.env.FLOW_WIKI_AGENT || '').trim().toLowerCase();
  if (disabled === '0' || disabled === 'false' || disabled === 'no') return false;
  return true;
}

export function resolveWikiModel(): string | undefined {
  const model = (process.env.FLOW_WIKI_MODEL || process.env.CLAUDE_MODEL || '').trim();
  return model || undefined;
}

/** Disable agentic /llm-wiki skill run; use --print JSON only. */
export function shouldUseAgenticWikiSkill(): boolean {
  const printOnly = (process.env.FLOW_WIKI_PRINT_ONLY || '').trim().toLowerCase();
  if (printOnly === '1' || printOnly === 'true' || printOnly === 'yes') return false;
  return shouldUseClaudeWikiAgent();
}

export function buildWikiAgentSkillPrompt(input: WikiAgentRunInput): string {
  const body = buildWikiAgentSkillContext(input);
  return [
    '/llm-wiki',
    '',
    '## Task: Phase 1 ingest (Flow Observer)',
    '',
    'Follow llm-wiki skill Phase 1 + gui-anything-layout.md + wiki/knowledge/SCHEMA.md.',
    'Write entry bodies under knowledge/contexts/{intent_key}/ or entities/ (optional summaries/).',
    'Use the digest intent_key as the contexts/ subfolder when curating a closed intent bucket.',
    'Index, log, progress HTML are rebuilt by the app — not your job.',
    '',
    body,
    '',
    '---',
    '',
    'After disk writes, output ONLY one JSON manifest (files_written required on create/update):',
    WIKI_AGENT_MANIFEST_SCHEMA,
  ].join('\n');
}

/** Agentic run: /llm-wiki + Read/Edit/Write; agent writes disk, manifest at end. */
export async function runWikiAgentSkill(input: WikiAgentRunInput): Promise<{
  manifest: WikiAgentManifest | null;
  decision: WikiAgentDecision | null;
  source: 'skill' | 'fallback';
  fallbackReason?: string;
}> {
  if (!shouldUseAgenticWikiSkill()) {
    return { manifest: null, decision: null, source: 'fallback', fallbackReason: 'rules_only' };
  }

  const wikiRoot = resolveWikiRoot();
  const promptText = buildWikiAgentSkillPrompt(input);
  const claudeCwd = resolveWikiClaudeCwd();
  const result = await runClaudeAgentPrompt(promptText, {
    model: input.model ?? resolveWikiModel(),
    timeoutMs: 120_000,
    taskIdPrefix: 'wiki_skill',
    permissionMode: 'acceptEdits',
    allowedTools: ['Read', 'Edit', 'Write'],
    addDir: resolveWikiAgentAddDirs(wikiRoot),
    cwd: claudeCwd,
  });

  if (!result.ok) {
    return {
      manifest: null,
      decision: null,
      source: 'fallback',
      fallbackReason: result.reason ?? 'skill_failed',
    };
  }

  const manifest = parseWikiAgentManifest(result.output);
  if (!manifest) {
    return {
      manifest: null,
      decision: null,
      source: 'fallback',
      fallbackReason: 'manifest_parse_failed',
    };
  }

  if (manifest.action === 'skip') {
    return {
      manifest,
      decision: {
        action: 'skip',
        type: 'context',
        slug: 'skip',
        sections: { summary: '', solution: '' },
        related_ids: [],
        tags: [],
        reason: manifest.reason,
      },
      source: 'skill',
    };
  }

  const decision = manifestToDecision(manifest, input);
  if (!decision) {
    return {
      manifest,
      decision: null,
      source: 'fallback',
      fallbackReason: 'manifest_to_decision_failed',
    };
  }

  return {
    manifest,
    decision: reconcileWikiDecision(decision, input.priorHit),
    source: 'skill',
  };
}

function manifestToDecision(
  manifest: WikiAgentManifest,
  input: WikiAgentRunInput,
): WikiAgentDecision | null {
  const meta = input.summary.persistMeta;
  const summaryText = input.summary.summary || '';
  const solution = meta?.solution_detail || summaryText;

  if (manifest.action === 'update') {
    const targetId = manifest.target_id
      ?? input.priorHit?.entry.id
      ?? inferIdFromFiles(manifest.files_written);
    if (!targetId) return null;
    const existing = input.priorHit?.entry
      ?? input.candidates.find((c) => c.id === targetId);
    return {
      action: 'update',
      target_id: targetId,
      type: toAgentEntryType(existing?.type ?? 'context'),
      slug: existing?.slug ?? 'update',
      sections: {
        summary: summaryText,
        solution,
      },
      related_ids: [],
      tags: meta?.tags ?? existing?.tags ?? [],
      reason: manifest.reason,
    };
  }

  if (manifest.action === 'create') {
    return {
      action: 'create',
      type: meta?.type === 'entity' ? 'entity' : 'context',
      slug: inferSlugFromFiles(manifest.files_written) ?? 'new-entry',
      sections: {
        summary: summaryText,
        solution,
      },
      related_ids: [],
      tags: meta?.tags ?? [],
      reason: manifest.reason,
    };
  }

  return null;
}

function inferIdFromFiles(files?: string[]): string | undefined {
  if (!files?.length) return undefined;
  for (const file of files) {
    const base = file.split('/').pop() ?? file;
    const m = base.match(/^([A-Z]\d+)-/);
    if (m) return m[1];
  }
  return undefined;
}

function inferSlugFromFiles(files?: string[]): string | undefined {
  if (!files?.length) return undefined;
  for (const file of files) {
    const base = file.split('/').pop() ?? file;
    const m = base.match(/^[A-Z]\d+-(.+)\.md$/);
    if (m) return m[1];
  }
  return undefined;
}

/** Spawn Claude CLI subagent with llm-wiki-style ingest prompt (--print JSON). */
export async function runWikiAgentClaude(input: WikiAgentRunInput): Promise<{
  decision: WikiAgentDecision | null;
  source: 'claude' | 'fallback';
  fallbackReason?: string;
}> {
  if (!shouldUseClaudeWikiAgent()) {
    return { decision: null, source: 'fallback', fallbackReason: 'rules_only' };
  }

  const promptText = buildWikiAgentPrompt(input);
  const result = await runClaudePrintPrompt(promptText, {
    model: input.model ?? resolveWikiModel(),
    timeoutMs: 60_000,
    taskIdPrefix: 'wiki_agent',
  });

  if (!result.ok) {
    return {
      decision: null,
      source: 'fallback',
      fallbackReason: result.reason ?? 'claude_failed',
    };
  }

  const validated = validateWikiAgentDecision(result.output);
  if (!validated.success) {
    return {
      decision: null,
      source: 'fallback',
      fallbackReason: validated.fallbackReason,
    };
  }

  const decision = reconcileWikiDecision(validated.data, input.priorHit);
  return { decision, source: 'claude' };
}

/** Prior hit must not create a duplicate id — reconcile agent mistakes. */
export function reconcileWikiDecision(
  decision: WikiAgentDecision,
  priorHit: WikiMatch | null,
): WikiAgentDecision {
  if (!priorHit || decision.action !== 'create') return decision;
  const entry = priorHit.entry;
  return {
    ...decision,
    action: 'update',
    target_id: entry.id,
    type: toAgentEntryType(entry.type),
    slug: entry.slug || decision.slug,
    tags: decision.tags.length > 0 ? decision.tags : entry.tags,
    reason: `prior_hit_reconcile:${entry.id}`,
  };
}

/** Claude skill first, then --print JSON, then rule-based resolveWikiDecision. */
export async function resolveWikiDecisionAsync(
  input: WikiAgentRunInput,
): Promise<{
  decision: WikiAgentDecision | null;
  source: 'skill' | 'claude' | 'rules';
  manifest?: WikiAgentManifest | null;
  agentWroteDisk?: boolean;
  diskProofReason?: string;
}> {
  const skill = await runWikiAgentSkill(input);
  if (skill.decision && skill.source === 'skill' && skill.manifest) {
    const wikiRoot = resolveWikiRoot();
    const repo = new KnowledgeRepository(wikiRoot);
    const proof = await resolveAgentWriteProof(
      skill.manifest,
      wikiRoot,
      repo,
      input.summary.sessionId || '',
      input.summary.id,
      input.priorHit,
    );
    return {
      decision: skill.decision,
      source: 'skill',
      manifest: skill.manifest,
      agentWroteDisk: proof.ok,
      diskProofReason: proof.ok ? undefined : proof.reason,
    };
  }

  const claude = await runWikiAgentClaude(input);
  if (claude.decision) {
    return { decision: claude.decision, source: 'claude', manifest: null, agentWroteDisk: false };
  }
  if (input.digest) {
    return {
      decision: resolveWikiDecision({ summary: input.summary, priorHit: input.priorHit, digest: input.digest }),
      source: 'rules',
      manifest: null,
      agentWroteDisk: false,
    };
  }
  return {
    decision: resolveWikiDecision({ summary: input.summary, priorHit: input.priorHit }),
    source: 'rules',
    manifest: null,
    agentWroteDisk: false,
  };
}

const categoryByType: Record<KnowledgeEntry['type'], string> = {
  context: 'contexts',
  entity: 'entities',
  summary: 'summaries',
};

function yamlBlockList(items: string[]): string {
  if (items.length === 0) return '  []';
  return items.map((item) => `  - "${item.replace(/"/g, '\\"')}"`).join('\n');
}

/** Rule-based decision — default path (no LLM). Intent digest mode skips create without prior. */
export function resolveWikiDecision(input: {
  summary: ExplorationSummary;
  priorHit: WikiMatch | null;
  digest?: IntentDigest;
}): WikiAgentDecision | null {
  if (input.priorHit) {
    const entry = input.priorHit.entry;
    return {
      action: 'update',
      target_id: entry.id,
      type: toAgentEntryType(entry.type),
      slug: entry.slug || entry.id.toLowerCase(),
      sections: {
        summary: input.summary.summary,
        solution: input.summary.persistMeta?.solution_detail || input.summary.summary,
        commands: pickCommands(input.summary),
      },
      related_ids: [],
      tags: input.summary.persistMeta?.tags ?? entry.tags ?? [],
      reason: `prior_knowledge_hit:${entry.id}`,
    };
  }

  if (input.digest) {
    return {
      action: 'skip',
      type: 'context',
      slug: 'skip',
      sections: { summary: '', solution: '' },
      related_ids: [],
      tags: [],
      reason: 'skill_only_no_prior',
    };
  }

  const extracted = extractWikiEntry(input.summary);
  if (!extracted) {
    return {
      action: 'skip',
      type: 'context',
      slug: 'skip',
      sections: { summary: '', solution: '' },
      related_ids: [],
      tags: [],
      reason: 'low_value_or_opt_out',
    };
  }

  return {
    action: 'create',
    type: extracted.type,
    slug: extracted.slug,
    sections: {
      summary: input.summary.summary,
      solution: input.summary.persistMeta?.solution_detail || extracted.solution || input.summary.summary,
      commands: pickCommands(input.summary, extracted),
    },
    related_ids: [],
    tags: input.summary.persistMeta?.tags ?? [],
    reason: 'new_knowledge',
  };
}

function pickCommands(
  summary: ExplorationSummary,
  extracted?: WikiExtractionResult,
): string[] | undefined {
  const fromMeta = summary.persistMeta?.key_command?.trim();
  const cmds = [
    ...(fromMeta ? [fromMeta] : []),
    ...(extracted?.command ? [extracted.command] : []),
    ...summary.commands.filter((c) => looksLikeShell(c)),
  ];
  const unique = [...new Set(cmds.map((c) => c.trim()).filter(Boolean))];
  return unique.length > 0 ? unique.slice(0, 3) : undefined;
}

function looksLikeShell(cmd: string): boolean {
  const t = cmd.trim();
  if (t.length < 2) return false;
  if (t.startsWith('{') || t.startsWith('[')) return false;
  if (/^Read\s/i.test(t)) return false;
  return true;
}

export function renderKnowledgeMarkdown(input: {
  decision: WikiAgentDecision;
  summary: ExplorationSummary;
  existing?: KnowledgeEntry;
}): string {
  if (input.decision.action === 'update' && input.existing) {
    return mergeKnowledgeContent(input.existing.content, input.decision, input.summary);
  }

  const extracted = extractWikiEntry(input.summary);
  if (extracted?.content) {
    return extracted.content;
  }

  return renderFreshMarkdown(input.decision, input.summary);
}

function renderFreshMarkdown(decision: WikiAgentDecision, summary: ExplorationSummary): string {
  const dates = formatKnowledgeDates();
  const projTag = resolveProjectTag();
  const tagSet = new Set([...(decision.tags || []), projTag]);
  const sessionId = (summary.sessionId || 'unknown').trim() || 'unknown';
  const commands = decision.sections.commands ?? [];

  return `---
id: "PLACEHOLDER"
slug: "${decision.slug}"
request: "${escapeYaml(summary.request || '')}"
created: "${dates.created}"
updated: "${dates.updated}"
version: 1
type: "${decision.type}"
category: "${categoryByType[decision.type]}"
tags:
${yamlBlockList([...tagSet])}
related: []
aliases: []
source:
  session_id: "${sessionId}"
  exploration_id: "${summary.id}"
sources:
  - session_id: "${sessionId}"
    exploration_id: "${summary.id}"
    saved_at: "${dates.created}"
extraction_confidence: ${summary.persistMeta?.confidence ?? 0.7}
status: "draft"
---
## 问题
${summary.request}

## 摘要
${decision.sections.summary}

## 解决方案
${decision.sections.solution}
${commands.length > 0 ? `\n## 命令\n\`\`\`bash\n${commands.join('\n')}\n\`\`\`` : ''}

## 参考
- 来源: Exploration ${summary.id}
`;
}

export function mergeKnowledgeContent(
  existingContent: string,
  decision: WikiAgentDecision,
  summary: ExplorationSummary,
): string {
  const at = new Date();
  const dates = formatKnowledgeDates(at);
  const sessionId = (summary.sessionId || 'unknown').trim() || 'unknown';
  const fmMatch = existingContent.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return existingContent + `\n\n## 更新 (${dates.updated.slice(0, 10)})\n${decision.sections.summary}\n`;
  }

  let yaml = applyKnowledgeDatesToYaml(fmMatch[1], 'update', at);
  const body = existingContent.slice(fmMatch[0].length);

  const versionMatch = yaml.match(/^version:\s*(\d+)/m);
  const nextVersion = versionMatch ? parseInt(versionMatch[1], 10) + 1 : 2;
  yaml = yaml.replace(/^version:\s*\d+/m, `version: ${nextVersion}`);
  if (!/^version:/m.test(yaml)) {
    yaml += `\nversion: ${nextVersion}`;
  }

  const sourceLine = `  - session_id: "${sessionId}"\n    exploration_id: "${summary.id}"\n    saved_at: "${dates.updated}"`;
  if (/^sources:/m.test(yaml)) {
    if (!yaml.includes(`exploration_id: "${summary.id}"`)) {
      yaml = yaml.replace(/^(sources:\s*\n(?:\s+-[^\n]+\n(?:\s+[^\n]+\n)*)*)/m, `$1${sourceLine}\n`);
    }
  } else {
    yaml += `\nsources:\n${sourceLine}`;
  }

  const addition = [
    '',
    `### 更新 ${dates.updated.slice(0, 10)} (${summary.id})`,
    decision.sections.summary,
    decision.sections.solution !== decision.sections.summary
      ? `\n${decision.sections.solution}`
      : '',
  ].join('\n');

  let newBody = body;
  const solutionIdx = newBody.search(/^## 解决方案/m);
  if (solutionIdx >= 0) {
    const afterSolution = newBody.slice(solutionIdx);
    const nextSection = afterSolution.search(/\n## [^#]/);
    if (nextSection > 0) {
      const head = newBody.slice(0, solutionIdx + nextSection);
      const tail = newBody.slice(solutionIdx + nextSection);
      newBody = head + addition + tail;
    } else {
      newBody = newBody + addition;
    }
  } else {
    newBody = newBody + `\n## 解决方案${addition}`;
  }

  const commands = decision.sections.commands ?? [];
  if (commands.length > 0 && !/^## 命令/m.test(newBody)) {
    newBody += `\n## 命令\n\`\`\`bash\n${commands.join('\n')}\n\`\`\``;
  }

  return `---\n${yaml}\n---${newBody}`;
}

/** Ensure agent-written markdown can be linked back to session/exploration on hydrate. */
export function ensureKnowledgeSourceMetadata(
  content: string,
  sessionId: string,
  explorationId: string,
): string {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return content;
  let yaml = fmMatch[1];
  const body = content.slice(fmMatch[0].length);
  const dates = formatKnowledgeDates();

  if (!/^source:/m.test(yaml)) {
    yaml += `\nsource:\n  session_id: "${sessionId}"\n  exploration_id: "${explorationId}"`;
  } else if (!/session_id:/m.test(yaml)) {
    yaml = yaml.replace(/^source:\s*[^\n]+$/m, `source:\n  session_id: "${sessionId}"\n  exploration_id: "${explorationId}"`);
  } else {
    yaml = yaml.replace(/session_id:\s*"?[^"\n]*"?/m, `session_id: "${sessionId}"`);
    if (/exploration_id:/m.test(yaml)) {
      yaml = yaml.replace(/exploration_id:\s*"?[^"\n]*"?/m, `exploration_id: "${explorationId}"`);
    } else {
      yaml = yaml.replace(
        /(source:\s*\n(?:\s+session_id:[^\n]+\n)?)/m,
        `$1  exploration_id: "${explorationId}"\n`,
      );
    }
  }

  const sourceLine = `  - session_id: "${sessionId}"\n    exploration_id: "${explorationId}"\n    saved_at: "${dates.updated}"`;
  if (/^sources:/m.test(yaml)) {
    if (!yaml.includes(`exploration_id: "${explorationId}"`)) {
      yaml = yaml.replace(/^(sources:\s*\n(?:\s+-[^\n]+\n(?:\s+[^\n]+\n)*)*)/m, `$1${sourceLine}\n`);
    }
  } else {
    yaml += `\nsources:\n${sourceLine}`;
  }

  return `---\n${yaml}\n---${body}`;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/** @deprecated Use shouldUseClaudeWikiAgent — Claude is default when not RULES_ONLY. */
export function wikiAgentEnabled(): boolean {
  return shouldUseClaudeWikiAgent();
}
