/**
 * Data Governance - 数据治理模块
 * 负责去重、一致性检查、孤儿数据清理
 */

import type { KnowledgeRepository, KnowledgeEntry } from '../wiki/knowledge-repository';
import type { EvidenceRepository } from '../wiki/evidence-repository';
import { filterProjectCompatibleKnowledge } from '../wiki/knowledge-scope';
import { requestSimilarity } from '../../services/wiki/match-service';

export interface DeduplicationResult {
  action: 'create' | 'update' | 'skip';
  targetId?: string;
  reason?: string;
  similarity?: number;
}

export interface CleanupReport {
  evidenceDeleted: string[];
  cacheCleared: string[];
  knowledgeConsolidated: number;
}

// 简单文本相似度计算（余弦相似度简化版）
export function calculateSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  // 计算交集
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  
  // Jaccard 相似度
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// 知识去重决策
export async function deduplicateKnowledge(
  newEntry: KnowledgeEntry,
  knowledgeRepo: KnowledgeRepository,
  options: { threshold?: number; confidenceGap?: number } = {}
): Promise<DeduplicationResult> {
  const { threshold = 0.75, confidenceGap = 0.1 } = options;
  
  // 1. 首先检查同一 source 是否已存在
  const existingBySource = await knowledgeRepo.findBySource(
    newEntry.sessionId,
    newEntry.explorationId
  );
  
  if (existingBySource) {
    // Agent or prior save already wrote this entry — not a duplicate of another row.
    if (existingBySource.id === newEntry.id) {
      return {
        action: 'update',
        targetId: existingBySource.id,
        reason: 'same_entry_refresh',
      };
    }
    // 同一 exploration，比较置信度决定是否更新
    if (newEntry.confidence > existingBySource.confidence + confidenceGap) {
      return {
        action: 'update',
        targetId: existingBySource.id,
        reason: 'higher_confidence_same_source',
      };
    }
    return {
      action: 'skip',
      targetId: existingBySource.id,
      reason: 'already_exists_same_source',
    };
  }
  
  // 2. 同类型 + 相同/极相似 request（与检索命中一致）
  const candidates = filterProjectCompatibleKnowledge(await knowledgeRepo.listByType(newEntry.type));

  for (const candidate of candidates) {
    const reqSim = requestSimilarity(newEntry.request, candidate.request);
    if (reqSim >= 0.85) {
      if (newEntry.confidence > candidate.confidence + confidenceGap) {
        return {
          action: 'update',
          targetId: candidate.id,
          reason: 'similar_request_higher_confidence',
          similarity: reqSim,
        };
      }
      return {
        action: 'skip',
        targetId: candidate.id,
        reason: 'similar_request_exists',
        similarity: reqSim,
      };
    }

    const similarity = calculateSimilarity(
      newEntry.content,
      candidate.content
    );
    
    if (similarity >= threshold) {
      // 内容相似，比较置信度
      if (newEntry.confidence > candidate.confidence + confidenceGap) {
        return {
          action: 'update',
          targetId: candidate.id,
          reason: 'similar_content_higher_confidence',
          similarity,
        };
      }
      return {
        action: 'skip',
        targetId: candidate.id,
        reason: 'similar_content_exists',
        similarity,
      };
    }
  }
  
  // 3. 没有相似内容，允许创建
  return { action: 'create' };
}

// 清理孤儿 evidence
export async function cleanupOrphanEvidence(
  evidenceRepo: EvidenceRepository,
  knowledgeRepo: KnowledgeRepository,
  options: { dryRun?: boolean; sessionMaxAge?: number } = {}
): Promise<CleanupReport> {
  const { dryRun = false, sessionMaxAge = 7 * 24 * 60 * 60 * 1000 } = options; // 默认7天
  
  const report: CleanupReport = {
    evidenceDeleted: [],
    cacheCleared: [],
    knowledgeConsolidated: 0,
  };
  
  const sessions = evidenceRepo.listSessions();
  const now = Date.now();
  
  for (const sessionId of sessions) {
    const evidence = evidenceRepo.loadEvidence(sessionId);
    if (!evidence) continue;
    
    // 检查 session 是否已结束（通过 evidence 中的 endedAt）
    const entries = Object.values(evidence.entries);
    const sessionEnded = entries.some(e => e.endedAt);
    const sessionAge = now - (evidence.cachedAt || 0);
    
    // 检查是否有对应的 knowledge
    const hasKnowledge = await knowledgeRepo.hasAnyFromSession(sessionId);
    
    // 清理条件：session 已结束 + 没有 knowledge + 超过最大年龄
    if (sessionEnded && !hasKnowledge && sessionAge > sessionMaxAge) {
      if (!dryRun) {
        evidenceRepo.deleteEvidence(sessionId);
      }
      report.evidenceDeleted.push(sessionId);
    }
  }
  
  return report;
}

// 知识库统计
export interface KnowledgeStats {
  total: number;
  byType: Record<string, number>;
  bySession: Record<string, number>;
  averageConfidence: number;
  orphans: number; // 无 evidence 的知识条目
}

export async function generateKnowledgeStats(
  knowledgeRepo: KnowledgeRepository,
  evidenceRepo: EvidenceRepository
): Promise<KnowledgeStats> {
  const all = await knowledgeRepo.listAll();
  
  const byType: Record<string, number> = {};
  const bySession: Record<string, number> = {};
  let totalConfidence = 0;
  let orphans = 0;
  
  for (const entry of all) {
    // 按类型统计
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    
    // 按 session 统计
    bySession[entry.sessionId] = (bySession[entry.sessionId] || 0) + 1;
    
    // 置信度
    totalConfidence += entry.confidence;
    
    // 检查是否有 evidence
    const evidence = evidenceRepo.loadEvidence(entry.sessionId);
    if (!evidence || !evidence.entries[entry.explorationId]) {
      orphans++;
    }
  }
  
  return {
    total: all.length,
    byType,
    bySession,
    averageConfidence: all.length > 0 ? totalConfidence / all.length : 0,
    orphans,
  };
}
