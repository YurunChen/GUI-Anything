/**
 * Knowledge Repository - 知识库统一访问接口
 * 提供知识条目的 CRUD 和搜索功能
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SessionId, ExplorationId } from '../protocol/observer-protocol';
import { resolveWikiRoot } from '../env';
import {
  contextIntentBucketDir,
  ensureDir,
  KNOWLEDGE_AGENT_ONLY_DIRS,
  KNOWLEDGE_ENTRY_DIRS,
  knowledgeTypeDir,
  wikiKnowledgeDir,
  wikiNotesDir,
} from './wiki-data-layout';
import { parseStorageType, type StorageKnowledgeType } from './knowledge-normalize';
import { walkMarkdownFiles } from '../../utils/file-walk';

export type KnowledgeType = StorageKnowledgeType;

const SAFE_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Reject path traversal and non-kebab slugs before save. */
export function assertSafeSlug(slug: string): boolean {
  const t = slug.trim();
  if (!t || t.length > 120) return false;
  if (t.includes('..') || t.includes('/') || t.includes('\\')) return false;
  return SAFE_SLUG_RE.test(t);
}

export interface KnowledgeEntry {
  id: string; // C001, N001, S001
  slug: string;
  sessionId: SessionId;
  explorationId: ExplorationId;
  type: KnowledgeType;
  request: string;
  content: string;
  confidence: number;
  tags: string[];
  createdAt: number;
  updatedAt?: number;
  /** Path relative to wiki root, e.g. knowledge/contexts/topic/C001-slug.md */
  relativePath?: string;
}

export interface SaveResult {
  success: boolean;
  path?: string;
  action: 'created' | 'updated' | 'skipped';
  reason?: string;
}

export interface SaveKnowledgeOptions {
  overwrite?: boolean;
  /** New context entries → knowledge/contexts/{intent_key}/ */
  intentKey?: string;
}

export interface KnowledgeStats {
  total: number;
  byType: Record<KnowledgeType, number>;
}

export const TYPE_TO_SUBDIR: Record<KnowledgeType, string> = {
  context: 'contexts',
  entity: 'entities',
  summary: 'summaries',
};

const MATCH_POOL_SUBDIRS = [...KNOWLEDGE_ENTRY_DIRS];
const ID_FROM_FILENAME_RE = /^([CNS]\d{3})-/i;

function cleanYamlListValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

function parseKnowledgeTags(yaml: string): string[] {
  const inlineTagsMatch = yaml.match(/^tags:\s*\[([^\]]*)\]\s*$/m);
  if (inlineTagsMatch) {
    return inlineTagsMatch[1]
      .split(',')
      .map(cleanYamlListValue)
      .filter(Boolean);
  }

  const tagsMatch = yaml.match(/^tags:\s*\n((?:[ \t]+-[ \t]*[^\n]+(?:\n|$))*)/m);
  return tagsMatch
    ? tagsMatch[1]
        .split('\n')
        .map(line => line.match(/-\s*(.+)/)?.[1])
        .filter((t): t is string => !!t)
        .map(cleanYamlListValue)
    : [];
}

function listKnowledgeFilesFromSubdirs(subdirs: readonly string[]): string[] {
  const wikiRoot = resolveWikiRoot();
  const files: string[] = [];
  for (const typeDir of subdirs) {
    walkMarkdownFiles(knowledgeTypeDir(typeDir, wikiRoot), files);
  }
  return files;
}

/** Recursive listing for a wiki root (includes summaries/). */
function listAllKnowledgeFilesForRoot(wikiRoot: string): string[] {
  const files = listMatchPoolKnowledgeFiles(wikiRoot);
  walkMarkdownFiles(path.join(wikiKnowledgeDir(wikiRoot), 'summaries'), files);
  return files;
}

// Recursive listing — all persisted entries (includes summaries/).
function listAllKnowledgeFiles(): string[] {
  return listAllKnowledgeFilesForRoot(resolveWikiRoot());
}

/** UI prior-hit pool — main entries only; summaries/ excluded. */
export function listMatchPoolKnowledgeFiles(wikiRoot?: string): string[] {
  const root = wikiRoot ?? resolveWikiRoot();
  const files: string[] = [];
  for (const typeDir of MATCH_POOL_SUBDIRS) {
    walkMarkdownFiles(path.join(wikiKnowledgeDir(root), typeDir), files);
  }
  return files;
}

/** Collect C/N/S ids from all knowledge entry dirs (incl. summaries/) for allocation. */
export function collectKnowledgeIds(wikiRoot?: string): string[] {
  const root = wikiRoot ?? resolveWikiRoot();
  const ids = new Set<string>();
  const knowledgeDir = wikiKnowledgeDir(root);

  for (const sub of [...KNOWLEDGE_ENTRY_DIRS, ...KNOWLEDGE_AGENT_ONLY_DIRS]) {
    const files: string[] = [];
    walkMarkdownFiles(path.join(knowledgeDir, sub), files);
    for (const filePath of files) {
      const base = path.basename(filePath);
      const fromName = base.match(ID_FROM_FILENAME_RE)?.[1];
      if (fromName) {
        ids.add(fromName.toUpperCase());
        continue;
      }
      const entry = parseKnowledgeFile(filePath, root);
      if (entry?.id) ids.add(entry.id);
    }
  }

  const notesDir = wikiNotesDir(root);
  if (fs.existsSync(notesDir)) {
    for (const file of fs.readdirSync(notesDir).filter((f) => f.endsWith('.md'))) {
      let text = '';
      try {
        text = fs.readFileSync(path.join(notesDir, file), 'utf-8');
      } catch {
        continue;
      }
      for (const line of text.split('\n')) {
        const match = line.match(/^id:\s*(N\d+)\s*$/i);
        if (match) ids.add(match[1].toUpperCase());
      }
    }
  }

  return [...ids];
}

export function knowledgeEntryWikiPath(entry: KnowledgeEntry): string {
  if (entry.relativePath) return `wiki/${entry.relativePath}`;
  const sub = TYPE_TO_SUBDIR[entry.type];
  return `wiki/knowledge/${sub}/${entry.id}-${entry.slug}.md`;
}

// 从文件路径解析知识条目
function parseKnowledgeFile(filePath: string, wikiRoot: string): KnowledgeEntry | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 解析 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;
    
    const yaml = frontmatterMatch[1];
    
    const idMatch = yaml.match(/^id:\s*"?([^"\n]+)"?$/m);
    const slugMatch = yaml.match(/^slug:\s*"?([^"\n]+)"?$/m);
    const requestMatch = yaml.match(/^request:\s*"?([^"\n]+)"?$/m);
    const typeMatch = yaml.match(/^type:\s*(\w+)$/m);
    const confidenceMatch = yaml.match(/^extraction_confidence:\s*([\d.]+)$/m);
    const createdMatch = yaml.match(/^created:\s*"?([^"\n]+)"?$/m);
    const updatedMatch = yaml.match(/^updated:\s*"?([^"\n]+)"?$/m);
    
    // 从 source block 解析 session/exploration
    const sourceMatch = yaml.match(/source:\s*\n([\s\S]*?)(?=\n\w+:|$)/);
    const sessionId = sourceMatch?.[1].match(/session_id:\s*"?([^"\n]+)"?/)?.[1] || '';
    const explorationId = sourceMatch?.[1].match(/exploration_id:\s*"?([^"\n]+)"?/)?.[1] || '';
    
    const tags = parseKnowledgeTags(yaml);
    
    if (!idMatch || !requestMatch) return null;
    
    const relativePath = path.relative(wikiRoot, filePath).replace(/\\/g, '/');

    return {
      id: idMatch[1].trim(),
      slug: slugMatch?.[1].trim() || '',
      sessionId: sessionId.trim(),
      explorationId: explorationId.trim(),
      type: parseStorageType(typeMatch?.[1]),
      request: requestMatch[1].trim(),
      content,
      confidence: parseFloat(confidenceMatch?.[1] || '0'),
      tags,
      createdAt: new Date(createdMatch?.[1] || Date.now()).getTime(),
      updatedAt: updatedMatch
        ? new Date(updatedMatch[1]).getTime()
        : undefined,
      relativePath,
    };
  } catch {
    return null;
  }
}

// 知识库 Repository 实现
export class KnowledgeRepository {
  private wikiRoot: string;

  constructor(wikiRoot?: string) {
    this.wikiRoot = wikiRoot || resolveWikiRoot();
  }

  getRoot(): string {
    return this.wikiRoot;
  }

  private listKnowledgeFiles(): string[] {
    return listAllKnowledgeFilesForRoot(this.wikiRoot);
  }

  // 根据 ID 查找
  async findById(id: string): Promise<KnowledgeEntry | null> {
    const files = this.listKnowledgeFiles();
    
    for (const file of files) {
      const entry = parseKnowledgeFile(file, this.wikiRoot);
      if (entry?.id === id) {
        return entry;
      }
    }
    
    return null;
  }

  // 根据 source 查找
  async findBySource(
    sessionId: SessionId,
    explorationId: ExplorationId
  ): Promise<KnowledgeEntry | null> {
    const files = this.listKnowledgeFiles();

    for (const file of files) {
      const entry = parseKnowledgeFile(file, this.wikiRoot);
      if (entry?.sessionId === sessionId && entry?.explorationId === explorationId) {
        return entry;
      }
    }
    
    return null;
  }

  // 检查 session 是否有任何 knowledge
  async hasAnyFromSession(sessionId: SessionId): Promise<boolean> {
    const files = this.listKnowledgeFiles();

    for (const file of files) {
      const entry = parseKnowledgeFile(file, this.wikiRoot);
      if (entry?.sessionId === sessionId) {
        return true;
      }
    }
    
    return false;
  }

  // 按类型列出
  async listByType(type: KnowledgeType): Promise<KnowledgeEntry[]> {
    const subDir = TYPE_TO_SUBDIR[type];
    const dir = knowledgeTypeDir(subDir, this.wikiRoot);
    const entries: KnowledgeEntry[] = [];

    try {
      const files: string[] = [];
      walkMarkdownFiles(dir, files);
      for (const file of files) {
        const entry = parseKnowledgeFile(file, this.wikiRoot);
        if (entry) entries.push(entry);
      }
    } catch {
      // 忽略错误
    }

    return entries;
  }

  /** Entries eligible for UI prior-hit search (excludes summaries/). */
  listMatchPoolSync(): KnowledgeEntry[] {
    const files = listMatchPoolKnowledgeFiles(this.wikiRoot);
    const entries: KnowledgeEntry[] = [];
    for (const file of files) {
      const entry = parseKnowledgeFile(file, this.wikiRoot);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  // 列出所有
  async listAll(): Promise<KnowledgeEntry[]> {
    const files = this.listKnowledgeFiles();
    const entries: KnowledgeEntry[] = [];
    
    for (const file of files) {
      const entry = parseKnowledgeFile(file, this.wikiRoot);
      if (entry) entries.push(entry);
    }
    
    return entries;
  }

  listAllSync(): KnowledgeEntry[] {
    const files = this.listKnowledgeFiles();
    const entries: KnowledgeEntry[] = [];
    for (const file of files) {
      const entry = parseKnowledgeFile(file, this.wikiRoot);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  // 搜索（简单关键词匹配）
  async search(query: string): Promise<KnowledgeEntry[]> {
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 1);
    const all = await this.listAll();
    
    return all.filter(entry => {
      const text = (entry.request + ' ' + entry.content).toLowerCase();
      return keywords.some(kw => text.includes(kw));
    });
  }

  // 统计
  async stats(): Promise<KnowledgeStats> {
    const all = await this.listAll();
    const byType: Record<KnowledgeType, number> = {
      context: 0,
      entity: 0,
      summary: 0,
    };
    
    for (const entry of all) {
      byType[entry.type]++;
    }
    
    return {
      total: all.length,
      byType,
    };
  }

  // 删除
  async delete(id: string): Promise<boolean> {
    const files = this.listKnowledgeFiles();
    for (const file of files) {
      const entry = parseKnowledgeFile(file, this.wikiRoot);
      if (entry?.id !== id) continue;
      try {
        fs.rmSync(file, { force: true });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // 保存知识条目（核心方法）
  async save(entry: KnowledgeEntry, options?: SaveKnowledgeOptions): Promise<SaveResult> {
    const { overwrite = false, intentKey } = options || {};

    if (!assertSafeSlug(entry.slug)) {
      return { success: false, action: 'skipped', reason: 'invalid_slug' };
    }

    // 检查是否已存在
    const existing = await this.findById(entry.id);
    if (existing && !overwrite) {
      return { success: false, action: 'skipped', reason: 'already_exists' };
    }
    
    ensureDir(wikiKnowledgeDir(this.wikiRoot));

    let filePath: string;
    if (existing?.relativePath) {
      filePath = path.join(this.wikiRoot, existing.relativePath);
      ensureDir(path.dirname(filePath));
    } else {
      const subDir = TYPE_TO_SUBDIR[entry.type];
      let typeDir = knowledgeTypeDir(subDir, this.wikiRoot);
      if (entry.type === 'context' && intentKey?.trim()) {
        typeDir = contextIntentBucketDir(intentKey, this.wikiRoot);
      }
      ensureDir(typeDir);
      filePath = path.join(typeDir, `${entry.id}-${entry.slug}.md`);
    }
    
    try {
      fs.writeFileSync(filePath, entry.content, 'utf-8');
      return {
        success: true,
        path: filePath,
        action: existing ? 'updated' : 'created',
      };
    } catch (e) {
      return {
        success: false,
        action: 'skipped',
        reason: e instanceof Error ? e.message : 'write_failed',
      };
    }
  }
}

// 单例导出
let defaultRepo: KnowledgeRepository | null = null;

export function getKnowledgeRepository(): KnowledgeRepository {
  if (!defaultRepo) {
    defaultRepo = new KnowledgeRepository();
  }
  return defaultRepo;
}
