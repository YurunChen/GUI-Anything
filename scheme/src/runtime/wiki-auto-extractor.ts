/**
 * Wiki Auto Extractor
 * 从 Flow Summary 自动提取并生成 Wiki 条目
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Agent-side persist decision (from exploration summary JSON). */
export type WikiPersistType = 'error' | 'snippet' | 'decision' | 'context' | 'none';

export interface WikiPersistMeta {
  should_persist: boolean;
  type: WikiPersistType;
  confidence: number;
  reason?: string;
  /** Detailed process for Wiki "解决方案" section. */
  solution_detail?: string;
  tags?: string[];
  key_command?: string | null;
}

export interface ExplorationSummary {
  id: string;
  request?: string;
  summary: string;
  commands: string[];
  files: string[];
  nodes?: Array<{
    timestamp: number;
    type: string;
    label: string;
    status?: string;
    phase?: string;
    rawCommand?: string;
  }>;
  result: 'success' | 'failure' | 'abandoned';
  duration: number;
  tokens: number;
  sessionId?: string;
  /** When set, gates persist and can override type/confidence from heuristics. */
  persistMeta?: WikiPersistMeta | null;
}

export interface WikiExtractionResult {
  id: string;
  slug: string;
  request: string;
  type: 'error' | 'snippet' | 'decision' | 'context';
  problem?: string;
  solution?: string;
  command?: string;
  confidence: number;
  content: string;
  evidencePath?: string;
  evidenceContent?: string;
}

export interface InspirationRecord {
  id: string;
  title: string;
  created: string;
  path: string;
  body?: string;
}

const KNOWLEDGE_BASE_DIR = 'knowledge-base';
const NOTE_BASE_DIR = 'note-base';
const EVIDENCE_DIR = 'evidence';

// Wiki 根目录
function getWikiRoot(): string {
  const projectRoot = process.env.FLOW_PROJECT_DIR || process.env.FLOW_ROOT_DIR;
  if (projectRoot) {
    return path.join(projectRoot, 'wiki');
  }
  const cwdWiki = path.join(process.cwd(), 'wiki');
  if (fs.existsSync(cwdWiki)) return cwdWiki;
  const parentWiki = path.join(process.cwd(), '..', 'wiki');
  if (fs.existsSync(parentWiki)) return parentWiki;
  return cwdWiki;
}

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
  const wikiRoot = getWikiRoot();
  const ids: string[] = [];
  
  const categories = [KNOWLEDGE_BASE_DIR, NOTE_BASE_DIR];
  
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
${result.evidencePath ? `  evidence_path: "${result.evidencePath}"` : ''}
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

**注意**: 此条目由系统自动提取 (置信度: ${Math.round(result.confidence * 100)}%)。请审核后移动到正确目录。
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
  const slug = toKebabCase(analysis.request);
  const sourceSessionId = (summary.sessionId || process.env.FLOW_SESSION_ID || 'unknown').trim() || 'unknown';
  const evidencePath = `${EVIDENCE_DIR}/${sourceSessionId}/${summary.id}.json`;

  const result: WikiExtractionResult = {
    id,
    slug,
    request: analysis.request,
    type: effectiveType,
    problem: analysis.problem,
    solution: analysis.solution,
    command: effectiveCommand,
    confidence: effectiveConfidence,
    evidencePath,
    evidenceContent: buildEvidence(summary),
    content: '', // 稍后填充
  };

  result.content = generateWikiContent(result, summary);
  return result;
}

// 保存 Wiki 条目到 staging
export function saveWikiEntry(entry: WikiExtractionResult): string | null {
  const wikiRoot = getWikiRoot();
  const knowledgeDir = path.join(wikiRoot, KNOWLEDGE_BASE_DIR);
  
  // 确保目录存在
  if (!fs.existsSync(knowledgeDir)) {
    fs.mkdirSync(knowledgeDir, { recursive: true });
  }
  
  // 确定文件名
  const filename = `${entry.id}-${entry.slug}.md`;
  const filepath = path.join(knowledgeDir, filename);
  
  // 检查是否已存在 (避免重复)
  if (fs.existsSync(filepath)) {
    // 可以追加或覆盖，这里选择追加版本号
    return null;
  }
  
  try {
    if (entry.evidencePath && entry.evidenceContent) {
      const evidenceFullPath = path.join(wikiRoot, entry.evidencePath);
      const evidenceDir = path.dirname(evidenceFullPath);
      if (!fs.existsSync(evidenceDir)) {
        fs.mkdirSync(evidenceDir, { recursive: true });
      }
      fs.writeFileSync(evidenceFullPath, entry.evidenceContent, 'utf-8');
    }
    fs.writeFileSync(filepath, entry.content, 'utf-8');
    return filepath;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[wiki-auto-extractor] Failed to save entry ${entry.id}: ${message}`);
    return null;
  }
}

// 自动提取并保存 (供 Flow Observer 调用)
export function autoExtractAndSave(summary: ExplorationSummary): { saved: boolean; path?: string; id?: string } {
  const entry = extractWikiEntry(summary);
  
  if (!entry) {
    return { saved: false };
  }
  
  const savedPath = saveWikiEntry(entry);
  
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

  const wikiRoot = getWikiRoot();
  const summaryDir = path.join(wikiRoot, KNOWLEDGE_BASE_DIR);
  if (!fs.existsSync(summaryDir)) return {};

  const out: Record<string, string> = {};
  let files: string[] = [];
  try {
    files = fs.readdirSync(summaryDir).filter((name) => name.endsWith('.md'));
  } catch {
    return {};
  }

  for (const fileName of files) {
    const filePath = path.join(summaryDir, fileName);
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

  return out;
}

function getDailyNoteFilePath(): { noteDir: string; filePath: string; dateKey: string } {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateKey = `${yyyy}-${mm}-${dd}`;
  const wikiRoot = getWikiRoot();
  const noteDir = path.join(wikiRoot, NOTE_BASE_DIR);
  const filePath = path.join(noteDir, `${dateKey}.md`);
  return { noteDir, filePath, dateKey };
}

function buildDailyNoteHeader(dateKey: string): string {
  return `---
date: "${dateKey}"
type: "note-daily"
---

# Notes ${dateKey}

`;
}

function formatTimeHM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildDailyNoteEntry(id: string, title: string, content: string, created: Date): string {
  const ts = created.toISOString();
  const timeLabel = formatTimeHM(created);
  return `## [${timeLabel}] ${title}
id: ${id}
created: ${ts}
session_id: ${process.env.FLOW_SESSION_ID || 'unknown'}

${content}

---

`;
}

export function saveInspirationNote(rawText: string): { saved: boolean; path?: string; id?: string; title?: string } {
  const text = rawText.trim();
  if (!text) return { saved: false };

  const firstLine = text.split('\n')[0].trim();
  const title = (firstLine || text).slice(0, 80);
  const existingIds = getExistingIds();
  const id = generateId('context', existingIds);
  const now = new Date();
  const { noteDir, filePath, dateKey } = getDailyNoteFilePath();

  if (!fs.existsSync(noteDir)) {
    fs.mkdirSync(noteDir, { recursive: true });
  }
  const entryText = buildDailyNoteEntry(id, title, text, now);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buildDailyNoteHeader(dateKey), 'utf-8');
    }
    fs.appendFileSync(filePath, entryText, 'utf-8');
    return { saved: true, path: filePath, id, title };
  } catch {
    return { saved: false };
  }
}

export function listRecentInspirationNotes(limit = 6): InspirationRecord[] {
  const wikiRoot = getWikiRoot();
  const noteDir = path.join(wikiRoot, NOTE_BASE_DIR);
  if (!fs.existsSync(noteDir)) return [];

  const dailyFiles = fs
    .readdirSync(noteDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort((a, b) => b.localeCompare(a));

  const output: InspirationRecord[] = [];
  for (const fileName of dailyFiles) {
    if (output.length >= limit) break;
    const fullPath = path.join(noteDir, fileName);
    let text = '';
    try {
      text = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = text.split('\n');
    const dailyEntries: InspirationRecord[] = [];
    for (let i = 0; i < lines.length; i++) {
      const titleMatch = lines[i].match(/^## \[(\d{2}:\d{2})\]\s+(.+)$/);
      if (!titleMatch) continue;

      const title = (titleMatch[2] || '').trim() || 'Untitled';
      const idLine = lines[i + 1] || '';
      const createdLine = lines[i + 2] || '';
      const idMatch = idLine.match(/^id:\s*(.+)$/);
      const createdMatch = createdLine.match(/^created:\s*(.+)$/);
      const id = (idMatch?.[1] || '').trim() || `N${Date.now()}`;
      const created = (createdMatch?.[1] || '').trim() || new Date().toISOString();
      const bodyLines: string[] = [];
      for (let j = i + 4; j < lines.length; j++) {
        if (lines[j].trim() === '---') break;
        bodyLines.push(lines[j]);
      }
      const body = bodyLines.join('\n').trim();

      dailyEntries.push({ id, title, created, path: fullPath, body });
    }

    // Newest first inside a daily file
    dailyEntries.reverse();
    for (const entry of dailyEntries) {
      output.push(entry);
      if (output.length >= limit) break;
    }
  }
  return output;
}

// 批量提取 (会话结束时调用)
export function batchExtract(summaries: ExplorationSummary[]): {
  extracted: number;
  ids: string[];
} {
  const ids: string[] = [];
  
  for (const summary of summaries) {
    const result = autoExtractAndSave(summary);
    if (result.saved && result.id) {
      ids.push(result.id);
    }
  }
  
  return {
    extracted: ids.length,
    ids,
  };
}
