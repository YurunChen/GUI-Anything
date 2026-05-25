/**
 * Build Wiki Agent prompt for Claude subagent (llm-wiki ingest/update).
 */

import * as fs from 'node:fs';
import type { ExplorationSummary } from '../../../data/protocol/wiki-types';
import type { KnowledgeEntry } from '../../../data/wiki/knowledge-repository';
import type { WikiMatch } from '../../../data/protocol/wiki-types';
import { knowledgeSchemaPath, normalizeContextIntentBucket } from '../../../data/wiki/wiki-data-layout';
import { resolveWikiRoot } from '../../../data/env';
import type { IntentDigest } from '../../../services/wiki/intent-digest-service';
import { WIKI_AGENT_JSON_SCHEMA, WIKI_AGENT_SKILL_HEADER } from './skill-prompt';

export interface WikiAgentPromptInput {
  summary: ExplorationSummary;
  digest?: IntentDigest;
  priorHit: WikiMatch | null;
  candidates: KnowledgeEntry[];
  /** Truncated body of target page when updating */
  targetExcerpt?: string;
}

function loadSchemaExcerpt(wikiRoot?: string): string {
  const schemaPath = knowledgeSchemaPath(wikiRoot);
  try {
    if (!fs.existsSync(schemaPath)) return '';
    const text = fs.readFileSync(schemaPath, 'utf-8');
    return text.length > 2000 ? `${text.slice(0, 2000)}\n…(truncated)` : text;
  } catch {
    return '';
  }
}

function formatCandidate(entry: KnowledgeEntry, maxBody = 400): string {
  const body = entry.content.replace(/^---[\s\S]*?---\n?/, '').trim();
  const excerpt = body.length > maxBody ? `${body.slice(0, maxBody)}…` : body;
  return [
    `- ${entry.id} (${entry.type}) slug=${entry.slug}`,
    `  request: ${entry.request.slice(0, 120)}`,
    `  excerpt: ${excerpt.replace(/\n/g, ' ')}`,
  ].join('\n');
}

function buildExplorationPayloadBlocks(input: WikiAgentPromptInput): {
  schemaBlock: string;
  priorBlock: string;
  candidateBlock: string;
  explorationLines: string[];
} {
  const wikiRoot = resolveWikiRoot();
  const schemaBlock = loadSchemaExcerpt(wikiRoot);
  const candidateBlock = input.candidates.length > 0
    ? input.candidates.slice(0, 5).map((e) => formatCandidate(e)).join('\n')
    : '(none)';

  const priorBlock = input.priorHit
    ? [
      'Prior 命中（优先 update 该页，复利而非新建）：',
      `  target_id: ${input.priorHit.entry.id}`,
      `  score: ${Math.round(input.priorHit.score * 100)}%`,
      `  request: ${input.priorHit.entry.request}`,
      input.targetExcerpt ? `  当前页摘录:\n${input.targetExcerpt}` : '',
    ].filter(Boolean).join('\n')
    : 'Prior 命中: 无';

  const meta = input.summary.persistMeta;
  const explorationLines = input.digest
    ? buildDigestLines(input.digest, candidateBlock)
    : [
      '【本轮探索】',
      `request: ${input.summary.request}`,
      `session_id: ${input.summary.sessionId || 'unknown'} · exploration_id: ${input.summary.id}`,
      '',
      '【心流结论（素材，勿编造）】',
      `summary: ${input.summary.summary}`,
      meta?.solution_detail ? `solution_detail: ${meta.solution_detail}` : '',
      meta?.key_command ? `key_command: ${meta.key_command}` : '',
      meta?.tags?.length ? `tags: ${meta.tags.join(', ')}` : '',
      meta?.type ? `persist_type: ${meta.type}` : '',
      meta?.should_persist === false ? 'persist: 本轮建议不写入' : 'persist: 本轮建议写入',
      meta?.reason ? `persist_reason: ${meta.reason}` : '',
      '',
      '【其他候选条目】',
      candidateBlock,
    ];

  return { schemaBlock, priorBlock, candidateBlock, explorationLines };
}

function buildDigestLines(digest: IntentDigest, candidateBlock: string): string[] {
  const turnBlocks = digest.explorations.map((exp, index) => [
    `#### Turn ${index + 1} · ${exp.explorationId}`,
    `request: ${exp.request}`,
    `summary: ${exp.summary}`,
    exp.solutionDetail ? `solution_detail: ${exp.solutionDetail}` : '',
    exp.keyCommand ? `key_command: ${exp.keyCommand}` : '',
    exp.tags?.length ? `tags: ${exp.tags.join(', ')}` : '',
    exp.shouldPersist === false ? 'persist: 建议不写入' : '',
  ].filter(Boolean).join('\n'));

  return [
    '【Intent 多轮 digest（pivot 关闭节点）】',
    `intent_key: ${digest.intentKey}`,
    `node_title: ${digest.nodeTitle}`,
    `session_id: ${digest.sessionId}`,
    `turns: ${digest.explorations.length}`,
    '',
    `【落盘路径】context 条目写在 knowledge/contexts/${normalizeContextIntentBucket(digest.intentKey)}/ 下（与 intent bucket 对齐；勿堆在 contexts/ 根目录）。`,
    '',
    ...turnBlocks,
    '',
    digest.evidenceExcerpt ? `【Evidence 摘录】\n${digest.evidenceExcerpt}\n` : '',
    '【其他候选条目】',
    candidateBlock,
  ];
}

/** Agentic /llm-wiki: exploration context only (manifest JSON at end of skill prompt). */
export function buildWikiAgentSkillContext(input: WikiAgentPromptInput): string {
  const { schemaBlock, priorBlock, explorationLines } = buildExplorationPayloadBlocks(input);
  const lines = [
    WIKI_AGENT_SKILL_HEADER,
    '',
    '---',
    '',
    schemaBlock ? `【wiki/knowledge/SCHEMA.md】\n${schemaBlock}\n` : '',
    priorBlock,
    '',
    ...explorationLines,
  ];
  return lines.filter((l) => l !== undefined).join('\n');
}

/** --print JSON path: full decision schema in prompt. */
export function buildWikiAgentPrompt(input: WikiAgentPromptInput): string {
  const { schemaBlock, priorBlock, explorationLines } = buildExplorationPayloadBlocks(input);
  const lines = [
    WIKI_AGENT_SKILL_HEADER,
    WIKI_AGENT_JSON_SCHEMA,
    '',
    '---',
    '',
    schemaBlock ? `【wiki/knowledge/SCHEMA.md】\n${schemaBlock}\n` : '',
    priorBlock,
    '',
    ...explorationLines,
    'Output only the JSON manifest below.',
  ];

  return lines.filter((l) => l !== undefined).join('\n');
}
