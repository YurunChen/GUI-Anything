/**
 * Evidence Repository - Evidence 数据管理
 * 聚合存储 exploration 原始数据
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SessionId, ExplorationId } from '../protocol/observer-protocol';
import { resolveWikiRoot } from '../env';

export interface EvidenceEntry {
  explorationId: string;
  request: string;
  summary: string;
  result: string;
  duration: number;
  tokens: number;
  commands: string[];
  files: string[];
  nodes: unknown[];
  persistMeta: unknown | null;
  savedAt: string;
  endedAt?: number;
}

export interface EvidenceData {
  sessionId: string;
  cachedAt: number;
  entries: Record<ExplorationId, EvidenceEntry>;
}

const EVIDENCE_DIR = 'evidence';

export class EvidenceRepository {
  private wikiRoot: string;

  constructor(wikiRoot?: string) {
    this.wikiRoot = wikiRoot || resolveWikiRoot();
  }

  private getEvidenceDir(): string {
    return path.join(this.wikiRoot, EVIDENCE_DIR);
  }

  private getEvidencePath(sessionId: string): string {
    return path.join(this.getEvidenceDir(), `${sessionId}.json`);
  }

  // 列出所有有 evidence 的 session
  listSessions(): string[] {
    const dir = this.getEvidenceDir();
    try {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  // 加载单个 session 的 evidence
  loadEvidence(sessionId: SessionId): EvidenceData | null {
    const filePath = this.getEvidencePath(sessionId);
    
    try {
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      return {
        sessionId,
        cachedAt: data.cachedAt || Date.now(),
        entries: data,
      };
    } catch {
      return null;
    }
  }

  // 保存单个 exploration 的 evidence（增量追加）
  saveEvidence(
    sessionId: SessionId,
    explorationId: ExplorationId,
    entry: Omit<EvidenceEntry, 'explorationId'>
  ): void {
    const dir = this.getEvidenceDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = this.getEvidencePath(sessionId);
    
    // 读取现有数据或创建新对象
    let data: Record<string, unknown> = {};
    if (fs.existsSync(filePath)) {
      try {
        const existing = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(existing);
      } catch {
        data = {};
      }
    }
    
    // 添加新条目
    data[explorationId] = {
      ...entry,
      explorationId,
    };
    
    // 添加元数据
    data.cachedAt = Date.now();
    data.sessionId = sessionId;
    
    // 写回文件
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // 删除整个 session 的 evidence
  deleteEvidence(sessionId: SessionId): void {
    const filePath = this.getEvidencePath(sessionId);
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // 忽略错误
    }
  }

  // 删除单个 exploration 的 evidence
  deleteExplorationEvidence(
    sessionId: SessionId,
    explorationId: ExplorationId
  ): void {
    const filePath = this.getEvidencePath(sessionId);
    
    try {
      if (!fs.existsSync(filePath)) return;
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      delete data[explorationId];
      
      // 如果没有剩余条目，删除整个文件
      const remainingKeys = Object.keys(data).filter(k => !k.startsWith('_'));
      if (remainingKeys.length === 0) {
        fs.rmSync(filePath, { force: true });
      } else {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch {
      // 忽略错误
    }
  }

  // 获取所有 evidence 的统计
  stats(): { totalSessions: number; totalExplorations: number } {
    const sessions = this.listSessions();
    let totalExplorations = 0;
    
    for (const sessionId of sessions) {
      const evidence = this.loadEvidence(sessionId);
      if (evidence) {
        totalExplorations += Object.keys(evidence.entries).length;
      }
    }
    
    return {
      totalSessions: sessions.length,
      totalExplorations,
    };
  }
}

// 单例导出
let defaultRepo: EvidenceRepository | null = null;

export function getEvidenceRepository(): EvidenceRepository {
  if (!defaultRepo) {
    defaultRepo = new EvidenceRepository();
  }
  return defaultRepo;
}
