/**
 * Wiki Search Module
 * 从 Flow UI 中检索 Wiki 条目
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const KNOWLEDGE_BASE_DIR = 'knowledge-base';

export interface WikiEntry {
  id: string;
  slug: string;
  request: string;
  type: 'error' | 'snippet' | 'decision' | 'context';
  category: string;
  tags: string[];
  aliases: string[];
  problem?: string;
  solution?: string;
  command?: string;
  content: string;
  filePath: string;
  score: number;
}

export interface WikiMatch {
  entry: WikiEntry;
  score: number;
  matchedKeywords: string[];
}

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

// 提取关键词 (简单的中文/英文分词)
function extractKeywords(text: string): string[] {
  // 移除常见停用词
  const stopWords = new Set(['怎么', '什么', '为什么', '如何', '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
  
  // 提取字母数字和中文字符
  const words: string[] = [];
  
  // 英文单词
  const englishWords = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  words.push(...englishWords.filter(w => w.length > 2 && !stopWords.has(w)));
  
  // 中文词汇 (简单按长度提取)
  const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const chars of chineseChars) {
    // 提取 2-4 字词组
    for (let i = 0; i < chars.length - 1; i++) {
      for (let len = 2; len <= 4 && i + len <= chars.length; len++) {
        const word = chars.slice(i, i + len);
        if (!stopWords.has(word)) {
          words.push(word);
        }
      }
    }
  }
  
  return [...new Set(words)]; // 去重
}

// 解析 Wiki 条目的 frontmatter
function parseFrontmatter(content: string): Partial<WikiEntry> {
  const entry: Partial<WikiEntry> = {};
  
  // 匹配 YAML frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return entry;
  
  const yaml = match[1];
  
  // 解析 id
  const idMatch = yaml.match(/^id:\s*"?([^"\n]+)"?$/m);
  if (idMatch) entry.id = idMatch[1].trim();
  
  // 解析 slug
  const slugMatch = yaml.match(/^slug:\s*"?([^"\n]+)"?$/m);
  if (slugMatch) entry.slug = slugMatch[1].trim();
  
  // 解析 request
  const requestMatch = yaml.match(/^request:\s*"?([^"\n]+)"?$/m);
  if (requestMatch) entry.request = requestMatch[1].trim();
  
  // 解析 type
  const typeMatch = yaml.match(/^type:\s*(\w+)$/m);
  if (typeMatch) entry.type = typeMatch[1] as WikiEntry['type'];
  
  // 解析 category
  const catMatch = yaml.match(/^category:\s*(\w+)$/m);
  if (catMatch) entry.category = catMatch[1];
  
  // 解析 tags
  const tagsMatch = yaml.match(/^tags:\s*\n((?:\s+-\s*[^\n]+\n)*)/m);
  if (tagsMatch) {
    entry.tags = tagsMatch[1]
      .split('\n')
      .map(line => line.match(/-\s*(.+)/)?.[1])
      .filter((t): t is string => !!t);
  }
  
  // 解析 aliases
  const aliasesMatch = yaml.match(/^aliases:\s*\n((?:\s+-\s*[^\n]+\n)*)/m);
  if (aliasesMatch) {
    entry.aliases = aliasesMatch[1]
      .split('\n')
      .map(line => line.match(/-\s*(.+)/)?.[1])
      .filter((a): a is string => !!a);
  }
  
  return entry;
}

// 解析条目内容，提取问题和解决方案
function parseContent(content: string): { problem?: string; solution?: string; command?: string } {
  const result: { problem?: string; solution?: string; command?: string } = {};
  
  // 移除 frontmatter
  const body = content.replace(/^---\n[\s\S]*?\n---/, '').trim();
  
  // 提取标题后的问题描述
  const lines = body.split('\n').map(l => l.trim()).filter(l => l);
  
  // 查找 "问题" / "Problem" 部分
  for (let i = 0; i < lines.length; i++) {
    if (/^##?\s*(问题|Problem|症状|Symptoms)/i.test(lines[i])) {
      // 收集接下来的非空行直到下一个标题
      const problemLines: string[] = [];
      for (let j = i + 1; j < lines.length && !lines[j].startsWith('#'); j++) {
        if (lines[j] && !lines[j].startsWith('-') && !lines[j].startsWith('*')) {
          problemLines.push(lines[j].replace(/^[-*]\s*/, ''));
        }
      }
      result.problem = problemLines.slice(0, 2).join(' ').substring(0, 100);
    }
    
    // 查找 "解决方案" / "Solution" 部分
    if (/^##?\s*(解决方案|Solution|解决|Fix)/i.test(lines[i])) {
      const solutionLines: string[] = [];
      for (let j = i + 1; j < lines.length && !lines[j].startsWith('#'); j++) {
        solutionLines.push(lines[j]);
      }
      result.solution = solutionLines.slice(0, 3).join('\n');
      
      // 提取代码块中的命令
      const codeMatch = result.solution.match(/```\w*\n([^`]+)```/);
      if (codeMatch) {
        result.command = codeMatch[1].split('\n')[0].trim();
      }
    }
  }
  
  return result;
}

// 加载所有 Wiki 条目
export function loadWikiEntries(): WikiEntry[] {
  const wikiRoot = getWikiRoot();
  const entries: WikiEntry[] = [];
  const knowledgeDir = path.join(wikiRoot, KNOWLEDGE_BASE_DIR);
  if (!fs.existsSync(knowledgeDir)) return entries;

  const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md') && f !== 'index.md');
  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const parsedContent = parseContent(content);
      
      if (frontmatter.id && frontmatter.request) {
        entries.push({
          id: frontmatter.id,
          slug: frontmatter.slug || file.replace('.md', ''),
          request: frontmatter.request,
          type: frontmatter.type || 'context',
          category: frontmatter.category || 'knowledge',
          tags: frontmatter.tags || [],
          aliases: frontmatter.aliases || [],
          problem: parsedContent.problem,
          solution: parsedContent.solution,
          command: parsedContent.command,
          content: content,
          filePath,
          score: 0,
        });
      }
    } catch {
      // 忽略解析失败的文件
    }
  }
  
  return entries;
}

// 计算相似度分数
function calculateScore(entry: WikiEntry, keywords: string[], query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  
  // 1. 标题匹配 (最高权重)
  const requestLower = entry.request.toLowerCase();
  for (const kw of keywords) {
    if (requestLower.includes(kw)) {
      score += 10;
      if (requestLower === kw) score += 5; // 完全匹配
    }
  }
  
  // 2. 别名匹配
  for (const alias of entry.aliases) {
    const aliasLower = alias.toLowerCase();
    for (const kw of keywords) {
      if (aliasLower.includes(kw)) {
        score += 8;
      }
    }
  }
  
  // 3. 标签匹配
  for (const tag of entry.tags) {
    const tagLower = tag.toLowerCase();
    for (const kw of keywords) {
      if (tagLower.includes(kw)) {
        score += 6;
      }
    }
  }
  
  // 4. 问题描述匹配
  if (entry.problem) {
    const problemLower = entry.problem.toLowerCase();
    for (const kw of keywords) {
      if (problemLower.includes(kw)) {
        score += 4;
      }
    }
  }
  
  // 5. 全文内容匹配
  const contentLower = entry.content.toLowerCase();
  for (const kw of keywords) {
    if (contentLower.includes(kw)) {
      score += 2;
    }
  }
  
  // 6. ID 匹配 (精确匹配时高分)
  if (entry.id.toLowerCase() === queryLower || entry.slug.toLowerCase() === queryLower) {
    score += 20;
  }
  
  // 归一化到 0-1 范围 (假设最高可能分数约为 50)
  const normalizedScore = Math.min(score / 50, 1);
  
  return normalizedScore;
}

// 搜索 Wiki，返回最佳匹配 (如果相似度 >= threshold)
export function searchWiki(
  query: string,
  threshold: number = 0.90
): WikiMatch | null {
  if (!query || query.trim().length < 3) return null;
  
  const entries = loadWikiEntries();
  if (entries.length === 0) return null;
  
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return null;
  
  // 计算每个条目的分数
  let bestMatch: WikiMatch | null = null;
  
  for (const entry of entries) {
    const score = calculateScore(entry, keywords, query);
    
    if (score > (bestMatch?.score ?? 0)) {
      bestMatch = {
        entry: { ...entry, score },
        score,
        matchedKeywords: keywords,
      };
    }
  }
  
  // 只返回超过阈值的匹配
  if (bestMatch && bestMatch.score >= threshold) {
    return bestMatch;
  }
  
  return null;
}

// 获取 Wiki 统计信息
export function getWikiStats(): { total: number; byType: Record<string, number> } {
  const entries = loadWikiEntries();
  const byType: Record<string, number> = {};
  
  for (const entry of entries) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
  }
  
  return {
    total: entries.length,
    byType,
  };
}

// 缓存机制：每 60 秒重新加载
let cachedEntries: WikiEntry[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

export function loadWikiEntriesCached(): WikiEntry[] {
  const now = Date.now();
  if (!cachedEntries || now - cacheTime > CACHE_TTL) {
    cachedEntries = loadWikiEntries();
    cacheTime = now;
  }
  return cachedEntries;
}
