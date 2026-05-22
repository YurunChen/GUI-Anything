/**
 * Wiki Auto Extractor
 * 从 Flow Summary 自动提取并生成 Wiki 条目
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveWikiRoot } from '../../data/env';
import { KnowledgeRepository, type KnowledgeEntry } from '../../data/wiki/knowledge-repository';
import { EvidenceRepository } from '../../data/wiki/evidence-repository';
import type {
  ExplorationSummary,
  WikiExtractionResult,
  WikiPersistMeta,
  WikiPersistType,
} from '../../data/protocol/wiki-types';

export type {
  ExplorationSummary,
  WikiExtractionResult,
  WikiPersistMeta,
  WikiPersistType,
} from '../../data/protocol/wiki-types';

const KNOWLEDGE_BASE_DIR = 'knowledge-base';
const EVIDENCE_DIR = 'evidence';

// Type to subdirectory mapping
const TYPE_TO_SUBDIR: Record<WikiExtractionResult['type'], string> = {
  error: 'errors',
  snippet: 'snippets',
  decision: 'decisions',
  context: 'contexts',
};

// 生成 ID
function generateId(type: string, existingIds: string[]): string {
  const prefix = type.charAt(0).toUpperCase();
  let num = 1;
  
  // 找出当前最大编号
  for (const id of existingIds) {
    if (id.startsWith(prefix)) {
      const n = parseInt(id.slice(1), 10);
      if (!isNaN(n) && n >= num) {
        num = n + 1;
      }
    }
  }
  
  return `${prefix}${String(num).padStart(3, '0')}`;
}

// 获取现有所有 Wiki ID
function getExistingIds(): string[] {
  const wikiRoot = resolveWikiRoot();
  const ids: string[] = [];
  
  const categories = [KNOWLEDGE_BASE_DIR, 'daily-notes'];
  
  for (const category of categories) {
    const dir = path.join(wikiRoot, category);
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      // 从文件名提取 ID (如 E001-docker-daemon.md -> E001)
      const match = file.match(/^([A-Z]\d+)-/);
      if (match) {
        ids.push(match[1]);
      }
    }
  }
  
  return ids;
}

// kebab-case 转换
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

function stripKnownExtension(fileName: string): string {
  return fileName.replace(/\.(md|markdown|txt|json|ts|tsx|js|jsx)$/i, '');
}

function extractPathTopic(request: string): string | null {
  const match = request.match(/['"]?((?:\/|~\/)[^'"\s]+)['"]?/);
  if (!match) return null;

  const rawPath = match[1];
  const baseName = stripKnownExtension(path.basename(rawPath));
  if (!baseName || baseName === '/' || baseName === '.') return null;

  return baseName
    .replace(/[_\s]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function inferIntentSuffix(request: string): string {
  const normalized = request.toLowerCase();
  if (/可行|看下|评审|审查|review/.test(normalized)) return 'review';
  if (/架构|architecture/.test(normalized)) return 'architecture';
  if (/方案|plan/.test(normalized)) return 'plan';
  if (/修复|fix|bug|错误|报错/.test(normalized)) return 'fix';
  return 'note';
}

function generateKnowledgeSlug(input: {
  request: string;
  summary: string;
  tags?: string[];
}): string {
  const topic = extractPathTopic(input.request);
  if (topic) {
    return toKebabCase(`${topic}-${inferIntentSuffix(input.request)}`);
  }

  const tagText = (input.tags || [])
    .filter((tag) => /^[A-Za-z0-9 _-]+$/.test(tag))
    .slice(0, 3)
    .join(' ');
  const source = tagText || input.request || input.summary;
  return toKebabCase(source) || 'knowledge-entry';
}

// 分析 exploration：完全依赖模型判断，本地只做兜底默认
function analyzeExploration(summary: ExplorationSummary): {
  type: 'error' | 'snippet' | 'decision' | 'context';
  request: string;
  problem?: string;
  solution?: string;
  command?: string;
  confidence: number;
} {
  const normalizedRequest = (summary.request || '').trim();
  const effectiveRequest = normalizedRequest || summary.summary.substring(0, 50);

  // 优先使用模型返回的元数据
  const meta = summary.persistMeta;
  if (meta && meta.type && meta.type !== 'none') {
    return {
      type: meta.type,
      request: effectiveRequest,
      solution: summary.summary,
      command: summary.commands[0],
      confidence: meta.confidence,
    };
  }

  // 兜底：未分类知识，统一进 context
  return {
    type: 'context',
    request: effectiveRequest,
    solution: summary.summary,
    confidence: 0.75, // 默认置信度，确保能落盘
  };
}

// 生成 Wiki 条目内容
function yamlBlockList(items: string[]): string {
  if (items.length === 0) return '  []';
  return items.map((t) => `  - "${String(t).replace(/"/g, '\\"')}"`).join('\n');
}

function generateWikiContent(
  result: WikiExtractionResult,
  summary: ExplorationSummary
): string {
  const categoryByType: Record<WikiExtractionResult['type'], string> = {
    error: 'errors',
    snippet: 'snippets',
    decision: 'decisions',
    context: 'contexts',
  };
  const now = new Date().toISOString();
  const tags =
    summary.persistMeta?.tags && summary.persistMeta.tags.length > 0
      ? yamlBlockList(summary.persistMeta.tags)
      : '  []';

  const sourceSessionId = (summary.sessionId || process.env.FLOW_SESSION_ID || 'unknown').trim() || 'unknown';

  return `---
id: "${result.id}"
slug: "${result.slug}"
request: "${result.request}"
created: "${now}"
updated: "${now}"
version: 1
type: "${result.type}"
category: "${categoryByType[result.type]}"
tags:
${tags}
related: []
aliases: []
source:
  session_id: "${sourceSessionId}"
  exploration_id: "${summary.id}"
extraction_confidence: ${result.confidence}
status: "draft"
## 问题
${result.problem || result.request}

## 摘要
${summary.summary}

## 上下文
- 环境: ${process.platform === 'darwin' ? 'macOS' : 'Linux'}
- 探索结果: ${summary.result}
${result.command ? `- 关键命令: ${result.command}` : ''}
${summary.files.length > 0 ? `- 涉及文件: ${summary.files.slice(0, 5).join(', ')}` : ''}

## 解决方案
${summary.persistMeta?.solution_detail || result.solution || summary.summary}

${summary.persistMeta?.reason ? `## 落盘说明（模型）\n${summary.persistMeta.reason}\n` : ''}
${result.command ? `## 命令\n\`\`\`bash\n${result.command}\n\`\`\`` : ''}

## 参考
- 来源: Exploration ${summary.id}
- 结果: ${summary.result}

---

**注意**: 此条目由系统自动提取 (置信度: ${Math.round(result.confidence * 100)}%)。请审核内容是否准确。
`;
}

function normalizeWikiType(
  t: WikiPersistType | undefined,
): 'error' | 'snippet' | 'decision' | 'context' | null {
  if (t === 'error' || t === 'snippet' || t === 'decision' || t === 'context') return t;
  return null;
}

function buildEvidence(summary: ExplorationSummary): string {
  const payload = {
    schema_version: 1,
    saved_at: new Date().toISOString(),
    request: summary.request || '',
    summary: summary.summary,
    result: summary.result,
    duration: summary.duration,
    tokens: summary.tokens,
    source: {
      session_id: summary.sessionId || process.env.FLOW_SESSION_ID || 'unknown',
      exploration_id: summary.id,
    },
    commands: summary.commands,
    files: summary.files,
    persist_meta: summary.persistMeta || null,
    nodes: summary.nodes || [],
  };
  return JSON.stringify(payload, null, 2);
}

function isLowValueExploration(summary: ExplorationSummary): boolean {
  const request = (summary.request || '').trim().toLowerCase();
  const summaryText = (summary.summary || '').trim().toLowerCase();
  const commandCount = Array.isArray(summary.commands) ? summary.commands.length : 0;
  const fileCount = Array.isArray(summary.files) ? summary.files.length : 0;
  const nodes = Array.isArray(summary.nodes) ? summary.nodes : [];
  const hasToolLikeNode = nodes.some((n) => n.type === 'tool' || n.type === 'result');

  const shortAndEmpty = request.length <= 24 && commandCount === 0 && fileCount === 0 && !hasToolLikeNode;
  if (!shortAndEmpty) return false;

  const trivialKeywords = [
    'hello', 'hi', 'hey', '你好', '您好', '在吗', 'test', 'ping', 'thanks', 'thank you',
  ];
  return trivialKeywords.some((kw) => request === kw || summaryText.includes(kw));
}

// 主提取函数：完全依赖模型判断
export function extractWikiEntry(summary: ExplorationSummary): WikiExtractionResult | null {
  // 放弃的任务不进知识库
  if (summary.result === 'abandoned') {
    return null;
  }

  const meta = summary.persistMeta;

  // 模型明确不落盘时，直接跳过。
  if (meta && meta.should_persist === false) {
    return null;
  }

  // 低价值会话（问候/闲聊）跳过，避免污染知识库。
  if (isLowValueExploration(summary)) return null;

  // 内容太短（可能是无意义的问候）
  if (summary.summary.trim().length < 10) {
    return null;
  }

  // 完全依赖模型判断，本地只做兜底
  const analysis = analyzeExploration(summary);

  // 类型优先用模型的，否则用兜底
  const effectiveType = (meta?.type && meta.type !== 'none') ? meta.type : analysis.type;

  // 置信度优先用模型的，否则用兜底
  const effectiveConfidence = (meta && typeof meta.confidence === 'number')
    ? Math.min(1, Math.max(0, meta.confidence))
    : analysis.confidence;

  // 命令优先用模型的，否则从 summary 取
  const effectiveCommand = (meta?.key_command && meta.key_command.trim()) || analysis.command || summary.commands[0];

  const existingIds = getExistingIds();
  const id = generateId(effectiveType, existingIds);
  const slug = generateKnowledgeSlug({
    request: analysis.request,
    summary: summary.summary,
    tags: meta?.tags,
  });
  const sourceSessionId = (summary.sessionId || process.env.FLOW_SESSION_ID || 'unknown').trim() || 'unknown';

  const result: WikiExtractionResult = {
    id,
    slug,
    request: analysis.request,
    type: effectiveType,
    problem: analysis.problem,
    solution: analysis.solution,
    command: effectiveCommand,
    confidence: effectiveConfidence,
    sessionId: sourceSessionId,
    explorationId: summary.id,
    evidenceContent: buildEvidence(summary),
    content: '', // 稍后填充
  };

  result.content = generateWikiContent(result, summary);
  return result;
}

// 保存 Wiki 条目 - 使用 KnowledgeRepository 统一接口
export async function saveWikiEntry(
  entry: WikiExtractionResult,
  knowledgeRepo?: KnowledgeRepository
): Promise<string | null> {
  const repo = knowledgeRepo || new KnowledgeRepository();
  
  try {
    // Evidence 聚合存储: evidence/{sessionId}.json
    if (entry.evidenceContent && entry.sessionId) {
      const evidenceRepo = new EvidenceRepository();
      const evidenceData = JSON.parse(entry.evidenceContent);
      evidenceRepo.saveEvidence(entry.sessionId, entry.explorationId || 'unknown', {
        ...evidenceData,
        explorationId: entry.explorationId || 'unknown',
      });
    }
    
    // 使用 KnowledgeRepository 保存知识条目，确保只写入新格式：
    // wiki/knowledge-base/{type}/{id}-{slug}.md
    const knowledgeEntry: KnowledgeEntry = {
      id: entry.id,
      slug: entry.slug,
      sessionId: entry.sessionId || 'unknown',
      explorationId: entry.explorationId || 'unknown',
      type: entry.type,
      request: entry.request,
      content: entry.content,
      confidence: entry.confidence,
      tags: [],
      createdAt: Date.now(),
    };

    const result = await repo.save(knowledgeEntry);
    return result.success ? result.path || null : null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[wiki-auto-extractor] Failed to save entry ${entry.id}: ${message}`);
    return null;
  }
}

// 自动提取并保存 (供 Flow Observer 调用)
export async function autoExtractAndSave(
  summary: ExplorationSummary,
  knowledgeRepo?: KnowledgeRepository
): Promise<{ saved: boolean; path?: string; id?: string }> {
  const entry = extractWikiEntry(summary);
  
  if (!entry) {
    return { saved: false };
  }
  
  const savedPath = await saveWikiEntry(entry, knowledgeRepo);
  
  if (savedPath) {
    return {
      saved: true,
      path: savedPath,
      id: entry.id,
    };
  }
  
  return { saved: false };
}

export function loadWikiSummariesBySession(sessionId: string): Record<string, string> {
  const sid = (sessionId || '').trim();
  if (!sid) return {};

  const wikiRoot = resolveWikiRoot();
  const knowledgeDir = path.join(wikiRoot, KNOWLEDGE_BASE_DIR);
  if (!fs.existsSync(knowledgeDir)) return {};

  const out: Record<string, string> = {};
  
  // 递归遍历所有类型子目录
  const typeDirs = ['errors', 'snippets', 'decisions', 'contexts'];
  
  for (const typeDir of typeDirs) {
    const dir = path.join(knowledgeDir, typeDir);
    if (!fs.existsSync(dir)) continue;
    
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((name) => name.endsWith('.md'));
    } catch {
      continue;
    }

    for (const fileName of files) {
      const filePath = path.join(dir, fileName);
      let text = '';
      try {
        text = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const sourceBlockMatch = text.match(/source:\s*\n((?:[ \t]+[^\n]*\n)+)/m);
      if (!sourceBlockMatch) continue;
      const sourceBlock = sourceBlockMatch[1];
      const fileSessionId = (sourceBlock.match(/^\s*session_id:\s*"?(.*?)"?\s*$/m)?.[1] || '').trim();
      const explorationId = (sourceBlock.match(/^\s*exploration_id:\s*"?(.*?)"?\s*$/m)?.[1] || '').trim();
      if (!fileSessionId || !explorationId || fileSessionId !== sid) continue;

      // New format: prefer explicit "摘要", then "核心结论";
      // fallback to legacy "问题/摘要".
      const abstractMatch = text.match(/## 摘要\s*\n([\s\S]*?)\n\s*##\s+/m);
      const coreConclusionMatch = text.match(/## 核心结论\s*\n([\s\S]*?)\n\s*##\s+/m);
      const legacySummaryMatch = text.match(/## 问题\/摘要\s*\n([\s\S]*?)\n\s*##\s+/m);
      const summaryText = (abstractMatch?.[1] || coreConclusionMatch?.[1] || legacySummaryMatch?.[1] || '').trim();
      if (!summaryText) continue;

      out[explorationId] = summaryText;
    }
  }

  return out;
}

// 批量提取 (会话结束时调用)
export async function batchExtract(summaries: ExplorationSummary[]): Promise<{
  extracted: number;
  ids: string[];
}> {
  const ids: string[] = [];
  
  for (const summary of summaries) {
    const result = await autoExtractAndSave(summary);
    if (result.saved && result.id) {
      ids.push(result.id);
    }
  }
  
  return {
    extracted: ids.length,
    ids,
  };
}
