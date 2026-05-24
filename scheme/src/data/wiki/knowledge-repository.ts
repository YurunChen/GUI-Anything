/**
 * Knowledge Repository - 知识库统一访问接口
 * 提供知识条目的 CRUD 和搜索功能
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SessionId, ExplorationId } from '../protocol/observer-protocol';
import { resolveWikiRoot } from '../env';

export type KnowledgeType = 'error' | 'snippet' | 'decision' | 'context';

export interface KnowledgeEntry {
  id: string; // E001, S001, etc.
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
}

export interface SaveResult {
  success: boolean;
  path?: string;
  action: 'created' | 'updated' | 'skipped';
  reason?: string;
}

export interface KnowledgeStats {
  total: number;
  byType: Record<KnowledgeType, number>;
}

const KNOWLEDGE_BASE_DIR = 'knowledge-base';
const TYPE_TO_SUBDIR: Record<KnowledgeType, string> = {
  error: 'errors',
  snippet: 'snippets',
  decision: 'decisions',
  context: 'contexts',
};

// 递归列出所有知识条目文件
function listAllKnowledgeFiles(): string[] {
  const wikiRoot = resolveWikiRoot();
  const files: string[] = [];
  
  const typeDirs = ['errors', 'snippets', 'decisions', 'contexts'];
  
  for (const typeDir of typeDirs) {
    const dir = path.join(wikiRoot, KNOWLEDGE_BASE_DIR, typeDir);
    try {
      if (!fs.existsSync(dir)) continue;
      const dirFiles = fs.readdirSync(dir)
        .filter(f => f.endsWith('.md') && f !== 'index.md')
        .map(f => path.join(dir, f));
      files.push(...dirFiles);
    } catch {
      // 忽略读取失败的目录
    }
  }
  
  return files;
}

// 从文件路径解析知识条目
function parseKnowledgeFile(filePath: string): KnowledgeEntry | null {
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
    
    // 从 source block 解析 session/exploration
    const sourceMatch = yaml.match(/source:\s*\n([\s\S]*?)(?=\n\w+:|$)/);
    const sessionId = sourceMatch?.[1].match(/session_id:\s*"?([^"\n]+)"?/)?.[1] || '';
    const explorationId = sourceMatch?.[1].match(/exploration_id:\s*"?([^"\n]+)"?/)?.[1] || '';
    
    // 解析 tags
    const tagsMatch = yaml.match(/^tags:\s*\n((?:\s+-\s*[^\n]+\n)*)/m);
    const tags = tagsMatch
      ? tagsMatch[1]
          .split('\n')
          .map(line => line.match(/-\s*(.+)/)?.[1])
          .filter((t): t is string => !!t)
      : [];
    
    if (!idMatch || !requestMatch) return null;
    
    return {
      id: idMatch[1].trim(),
      slug: slugMatch?.[1].trim() || '',
      sessionId: sessionId.trim(),
      explorationId: explorationId.trim(),
      type: (typeMatch?.[1] as KnowledgeType) || 'context',
      request: requestMatch[1].trim(),
      content,
      confidence: parseFloat(confidenceMatch?.[1] || '0'),
      tags,
      createdAt: new Date(createdMatch?.[1] || Date.now()).getTime(),
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

  // 根据 ID 查找
  async findById(id: string): Promise<KnowledgeEntry | null> {
    const files = listAllKnowledgeFiles();
    
    for (const file of files) {
      const entry = parseKnowledgeFile(file);
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
    const files = listAllKnowledgeFiles();
    
    for (const file of files) {
      const entry = parseKnowledgeFile(file);
      if (entry?.sessionId === sessionId && entry?.explorationId === explorationId) {
        return entry;
      }
    }
    
    return null;
  }

  // 检查 session 是否有任何 knowledge
  async hasAnyFromSession(sessionId: SessionId): Promise<boolean> {
    const files = listAllKnowledgeFiles();
    
    for (const file of files) {
      const entry = parseKnowledgeFile(file);
      if (entry?.sessionId === sessionId) {
        return true;
      }
    }
    
    return false;
  }

  // 按类型列出
  async listByType(type: KnowledgeType): Promise<KnowledgeEntry[]> {
    const subDir = TYPE_TO_SUBDIR[type];
    const dir = path.join(this.wikiRoot, KNOWLEDGE_BASE_DIR, subDir);
    const entries: KnowledgeEntry[] = [];
    
    try {
      if (!fs.existsSync(dir)) return entries;
      
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(dir, f));
      
      for (const file of files) {
        const entry = parseKnowledgeFile(file);
        if (entry) entries.push(entry);
      }
    } catch {
      // 忽略错误
    }
    
    return entries;
  }

  // 列出所有
  async listAll(): Promise<KnowledgeEntry[]> {
    const files = listAllKnowledgeFiles();
    const entries: KnowledgeEntry[] = [];
    
    for (const file of files) {
      const entry = parseKnowledgeFile(file);
      if (entry) entries.push(entry);
    }
    
    return entries;
  }

  listAllSync(): KnowledgeEntry[] {
    const files = listAllKnowledgeFiles();
    const entries: KnowledgeEntry[] = [];
    for (const file of files) {
      const entry = parseKnowledgeFile(file);
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
      error: 0,
      snippet: 0,
      decision: 0,
      context: 0,
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
    const entry = await this.findById(id);
    if (!entry) return false;
    
    const subDir = TYPE_TO_SUBDIR[entry.type];
    const filePath = path.join(
      this.wikiRoot,
      KNOWLEDGE_BASE_DIR,
      subDir,
      `${id}-${entry.slug}.md`
    );
    
    try {
      fs.rmSync(filePath, { force: true });
      return true;
    } catch {
      return false;
    }
  }

  // 保存知识条目（核心方法）
  async save(entry: KnowledgeEntry, options?: { overwrite?: boolean }): Promise<SaveResult> {
    const { overwrite = false } = options || {};
    
    // 检查是否已存在
    const existing = await this.findById(entry.id);
    if (existing && !overwrite) {
      return { success: false, action: 'skipped', reason: 'already_exists' };
    }
    
    const subDir = TYPE_TO_SUBDIR[entry.type];
    const typeDir = path.join(this.wikiRoot, KNOWLEDGE_BASE_DIR, subDir);
    
    // 确保目录存在
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    
    const filePath = path.join(typeDir, `${entry.id}-${entry.slug}.md`);
    
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
